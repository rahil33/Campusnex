package com.campusnex;

import jakarta.servlet.ServletConfig;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Real NTP time (laboratory experiment 5).
 *
 * The servlet talks NTP over UDP to a public time server and returns the
 * corrected time as JSON. If the NTP server cannot be reached (for example the
 * firewall blocks UDP 123) the response says so and falls back to the
 * system clock of the Tomcat host, with source = "SYSTEM_CLOCK".
 * The NTP offset is cached for 60 seconds so the public pool is not hammered.
 */
public class NtpTimeServlet extends ApiServlet {
    private static final long CACHE_MILLIS = 60_000;

    private String host;
    private int port;
    private int timeout;

    private long cachedAt;
    private NtpClient.Result cached;
    private String lastError;

    @Override
    public void init(ServletConfig config) throws ServletException {
        super.init(config);
        host = param(config, "ntpHost", "pool.ntp.org");
        port = Integer.parseInt(param(config, "ntpPort", "123"));
        timeout = Integer.parseInt(param(config, "timeoutMillis", "2500"));
    }

    private static String param(ServletConfig c, String n, String d) {
        String v = c.getInitParameter(n);
        return v == null || v.isBlank() ? d : v.trim();
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        NtpClient.Result r = current();
        long now = System.currentTimeMillis();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("serverSystemMillis", now);
        if (r != null) {
            body.put("source", "NTP");
            body.put("epochMillis", now + r.offsetMillis());
            body.put("ntpServer", r.server());
            body.put("stratum", r.stratum());
            body.put("clockOffsetMs", r.offsetMillis());
            body.put("ntpDelayMs", r.delayMillis());
            body.put("note", "Time obtained by this servlet using the NTP protocol over UDP.");
        } else {
            body.put("source", "SYSTEM_CLOCK");
            body.put("epochMillis", now);
            body.put("ntpServer", host);
            body.put("fallbackReason", lastError);
            body.put("note", "NTP server unreachable from the servlet host; returning the host system clock.");
        }
        json(resp, HttpServletResponse.SC_OK, body);
    }

    private synchronized NtpClient.Result current() {
        long now = System.currentTimeMillis();
        if (cached != null && now - cachedAt < CACHE_MILLIS) return cached;
        if (cached == null && lastError != null && now - cachedAt < 10_000) return null; // avoid retry storms
        try {
            cached = NtpClient.query(host, port, timeout);
            cachedAt = now;
            lastError = null;
            return cached;
        } catch (IOException | RuntimeException e) {
            cached = null;
            cachedAt = now;
            lastError = e.getClass().getSimpleName() + ": " + e.getMessage();
            log("NTP query failed: " + lastError);
            return null;
        }
    }
}
