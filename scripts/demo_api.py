"""Exercise customer transfers and admin controls against a running local demo API."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, build_opener, ProxyHandler
import uuid


class Api:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")

    def request(self, method, path, *, body=None, token=None, key=None, expected=200):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        if key:
            headers["Idempotency-Key"] = key
        request = Request(self.base_url + path, method=method, headers=headers,
                          data=None if body is None else json.dumps(body).encode())
        # Loopback traffic must not depend on the caller's HTTP proxy environment.
        opener = build_opener(ProxyHandler({}))
        try:
            response = opener.open(request, timeout=15)
        except HTTPError as error:
            response = error
        with response:
            status = response.status
            result = json.load(response)
        if status != expected:
            raise AssertionError(f"{method} {path}: expected {expected}, got {status}: {result.get('detail', '')}")
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8081/api")
    parser.add_argument("--admin-email", default="admin@mjbank.dev")
    parser.add_argument("--admin-password", default="Admin123!", help="Local demo administrator only")
    args = parser.parse_args()
    address = urlparse(args.base_url)
    if address.scheme != "http" or address.hostname not in {"localhost", "127.0.0.1", "::1"}:
        parser.error("Use an HTTP loopback API with disposable demo data.")
    api = Api(args.base_url)
    suffix = uuid.uuid4().hex

    def customer(name):
        return api.request("POST", "/auth/register", expected=201, body={
            "fullName": name, "email": f"{name.split()[0].lower()}-{suffix}@example.com",
            "password": "DemoPassword123!",
        })["accessToken"]

    alice = customer("Alice Demo")
    bob = customer("Bob Demo")
    source = api.request("POST", "/accounts", token=alice, expected=201, body={
        "type": "CHECKING", "currency": "CAD", "initialDeposit": 100,
    })
    destination = api.request("POST", "/accounts", token=bob, expected=201, body={
        "type": "SAVINGS", "currency": "CAD",
    })
    recipient = api.request("GET", "/transfers/recipient?accountNumber=" + destination["accountNumber"], token=alice)
    assert recipient["displayName"] == "Bob D."
    payload = {"fromAccountId": source["id"], "toAccountNumber": destination["accountNumber"],
               "amount": 25, "description": "Parallel retry demo"}
    key = uuid.uuid4().hex
    with ThreadPoolExecutor(max_workers=4) as pool:
        receipts = list(pool.map(lambda _: api.request("POST", "/transfers", token=alice,
                                                      body=payload, key=key, expected=201), range(4)))
    references = {receipt["reference"] for receipt in receipts}
    assert len(references) == 1, "Parallel retries must share one transfer reference"
    reference = next(iter(references))
    api.request("POST", "/transfers", token=alice, body={**payload, "amount": 26}, key=key, expected=409)

    def account(token, account_id):
        return api.request("GET", f"/accounts/{account_id}", token=token)

    assert account(alice, source["id"])["balance"] == 75
    assert account(bob, destination["id"])["balance"] == 25
    outgoing = api.request("GET", f"/accounts/{source['id']}/transactions?type=TRANSFER_OUT", token=alice)
    incoming = api.request("GET", f"/accounts/{destination['id']}/transactions?type=TRANSFER_IN", token=bob)
    for page in (outgoing, incoming):
        assert page["totalElements"] == 1
        assert page["content"][0]["reference"] == reference
        assert page["content"][0]["amount"] == 25
    assert outgoing["content"][0]["balanceAfter"] == 75
    assert incoming["content"][0]["balanceAfter"] == 25
    api.request("GET", "/admin/stats", token=alice, expected=403)
    api.request("GET", "/accounts", expected=401)

    admin = api.request("POST", "/auth/login", body={"email": args.admin_email,
                                                    "password": args.admin_password})["accessToken"]
    stats = api.request("GET", "/admin/stats", token=admin)
    assert stats["totalCustomers"] >= 2
    frozen = api.request("POST", f"/accounts/{destination['id']}/freeze", token=admin)
    assert frozen["status"] == "FROZEN"
    try:
        api.request("POST", "/transfers", token=alice, body=payload, key=uuid.uuid4().hex, expected=422)
        assert account(alice, source["id"])["balance"] == 75
        assert account(bob, destination["id"])["balance"] == 25
    finally:
        api.request("POST", f"/accounts/{destination['id']}/unfreeze", token=admin)
    print(json.dumps({"parallelRequests": 4, "uniqueTransfers": 1, "reference": reference,
                      "customerBalancesCAD": {"source": 75, "destination": 25},
                      "ledgerLegs": {"outgoing": 1, "incoming": 1}, "payloadConflictStatus": 409,
                      "customerAdminDeniedStatus": 403, "adminFreezeRejectedTransferStatus": 422}, indent=2))


if __name__ == "__main__":
    main()
