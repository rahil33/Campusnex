package com.campusnex;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.Map;

/** Shared helpers for the CampusNex servlets. */
abstract class ApiServlet extends HttpServlet {

    protected void json(HttpServletResponse resp, int status, Map<String, Object> body) throws IOException {
        resp.setStatus(status);
        resp.setContentType("application/json;charset=UTF-8");
        resp.setHeader("Cache-Control", "no-store");
        try (PrintWriter out = resp.getWriter()) {
            out.print(Json.write(body));
        }
    }

    protected static String mask(String sessionId) {
        if (sessionId == null || sessionId.length() < 8) return "n/a";
        return sessionId.substring(0, 6) + "…";
    }
}
