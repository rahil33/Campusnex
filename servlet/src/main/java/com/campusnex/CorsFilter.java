package com.campusnex;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.FilterConfig;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Lets a frontend hosted elsewhere (for example on Vercel) call /api/*.
 * Only origins listed in the "allowedOrigins" init-param are accepted.
 * When the frontend is served by Tomcat itself (same origin) this filter
 * adds nothing, because browsers send no Origin header.
 */
public class CorsFilter implements Filter {
    private final Set<String> allowed = new HashSet<>();

    @Override
    public void init(FilterConfig config) {
        String list = config.getInitParameter("allowedOrigins");
        if (list != null) {
            Arrays.stream(list.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .forEach(allowed::add);
        }
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;
        String origin = request.getHeader("Origin");

        if (origin != null && allowed.contains(origin)) {
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Access-Control-Allow-Credentials", "true");
            response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            response.setHeader("Access-Control-Allow-Headers", "Content-Type");
            response.setHeader("Access-Control-Expose-Headers", "Content-Type, Date, X-Served-By");
            response.addHeader("Vary", "Origin");
        }
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            response.setStatus(HttpServletResponse.SC_NO_CONTENT);
            return;
        }
        chain.doFilter(req, res);
    }
}
