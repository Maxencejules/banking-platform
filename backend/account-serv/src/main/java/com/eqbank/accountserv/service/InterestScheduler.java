package com.eqbank.accountserv.service;

import com.eqbank.accountserv.dto.InterestRunResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Triggers the monthly interest run. Kept separate from {@link InterestService} so the call goes
 * through the service's transactional proxy (a self-invocation would bypass {@code @Transactional}).
 */
@Component
public class InterestScheduler {

    private static final Logger log = LoggerFactory.getLogger(InterestScheduler.class);

    private final InterestService interestService;

    public InterestScheduler(InterestService interestService) {
        this.interestService = interestService;
    }

    @Scheduled(cron = "${app.banking.interest-cron:0 0 3 1 * *}", zone = "UTC")
    public void runMonthlyInterest() {
        InterestRunResponse result = interestService.runMonthlyInterest();
        log.info("Scheduled interest run credited {} accounts: {}", result.accountsCredited(), result.totalInterest());
    }
}
