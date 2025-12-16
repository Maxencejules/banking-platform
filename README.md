# EQ Banking Platform

A full‑stack **digital banking accounts platform** inspired by EQ Bank, built with **Spring Boot** and **Angular**. This project demonstrates modern backend API design, frontend integration, validation, testing, and clean architecture practices aligned with real‑world financial systems.

---

## 🚀 Overview

The EQ Banking Platform allows users to:
- Create bank accounts
- View all accounts
- Deposit and withdraw funds
- Freeze, unfreeze, and close accounts
- Validate inputs on both frontend and backend
- Persist data using an in‑memory relational database

The project is intentionally designed to mirror **enterprise banking workflows** and **graduate‑level engineering expectations**.

---

## 🧱 Architecture

```
eq-banking-platform/
├── backend/
│   └── account-serv/        # Spring Boot microservice
│       ├── domain/          # JPA entities
│       ├── dto/             # Request/response DTOs
│       ├── repository/      # JPA repositories
│       ├── service/         # Business logic
│       ├── web/             # REST controllers
│       └── config/          # MVC + SPA forwarding config
│
├── frontend/
│   └── eq-banking-web/      # Angular application
│       ├── accounts/        # Feature module
│       ├── services/        # API services
│       └── ui/              # Components & styles
└── README.md
```

**Backend:** Spring Boot 4, Java 21, JPA, H2

**Frontend:** Angular, TypeScript, SCSS

---

## 🛠 Tech Stack

### Backend
- Java 21
- Spring Boot 4
- Spring MVC
- Spring Data JPA
- H2 (in‑memory database)
- Bean Validation (Jakarta Validation)
- JUnit 5 & Spring Test

### Frontend
- Angular
- TypeScript
- SCSS
- REST API integration

---

## 📡 REST API Endpoints

Base URL:
```
http://localhost:8081/api/accounts
```

| Method | Endpoint | Description |
|------|--------|-------------|
| POST | / | Create account |
| GET | / | Get all accounts |
| GET | /{id} | Get account by ID |
| POST | /{id}/deposit | Deposit funds |
| POST | /{id}/withdraw | Withdraw funds |
| POST | /{id}/freeze | Freeze account |
| POST | /{id}/unfreeze | Unfreeze account |
| POST | /{id}/close | Close account |

---

## 🧪 Testing Strategy

This project includes **unit and integration tests** aligned with enterprise standards.

### Implemented Tests
- `AccountServiceTest` – business logic validation
- `CreateAccountRequestValidationTest` – DTO validation rules

### Test Coverage Focus
- Input validation
- Default account state
- Persistence correctness
- API contract behavior

---

## ▶️ Running the Project

### Backend

```bash
cd backend/account-serv
./mvnw spring-boot:run
```

Backend runs on:
```
http://localhost:8081
```

### Frontend

```bash
cd frontend/eq-banking-web
npm install
ng serve
```

Frontend runs on:
```
http://localhost:4200
```

---

## 🔄 Frontend + Backend Integration

The Angular app consumes the Spring Boot API directly.

In production builds, Angular can be compiled into Spring Boot’s `static/` directory for a **single‑artifact deployment**.

---

## 🧠 Design Decisions

- **DTO‑first API design** to avoid entity leakage
- **Service‑layer business rules** (not controllers)
- **Explicit account state transitions** (ACTIVE, FROZEN, CLOSED)
- **Validation on backend for security**
- **Angular feature‑module separation**

---

## 📌 Future Enhancements

- Authentication & authorization (JWT / OAuth2)
- Persistent database (PostgreSQL)
- Pagination & filtering
- CI pipeline (GitHub Actions)
- API documentation (OpenAPI / Swagger)
- Dockerized deployment

---

## 👤 Author

**Maxence Jules**  
B.Sc. Computer Science Student  
Aspiring Software Engineer

GitHub: https://github.com/Maxencejules

---

## 📄 License

This project is provided for educational and portfolio purposes.

