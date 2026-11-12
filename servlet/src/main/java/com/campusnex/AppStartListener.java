package com.campusnex;

import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Runs once when Tomcat starts the web application. It creates the
 * application-wide counters that live in the ServletContext (shared by every
 * visitor and every session, reset when the application restarts).
 */
public class AppStartListener implements ServletContextListener {
    public static final String APP_HITS = "campusnex.appHits";
    public static final String APP_REQUESTS = "campusnex.appRequests";
    public static final String STARTED_AT = "campusnex.startedAt";

    @Override
    public void contextInitialized(ServletContextEvent event) {
        ServletContext ctx = event.getServletContext();
        ctx.setAttribute(APP_HITS, new AtomicInteger());
        ctx.setAttribute(APP_REQUESTS, new AtomicInteger());
        ctx.setAttribute(STARTED_AT, Instant.now().toString());
        ctx.log("CampusNex started: application counters initialised");
    }
}
