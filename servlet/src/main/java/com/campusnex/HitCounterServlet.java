package com.campusnex;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Hit counter (laboratory experiment 9).
 *
 *  - Session counter:     stored in the HttpSession (one value per browser session).
 *  - Application counter: stored in the ServletContext (one value shared by everybody).
 *
 * GET              -> counts one hit and returns JSON
 * GET ?peek=true   -> returns current values without counting
 * GET ?format=html -> returns a complete HTML page instead of JSON
 * POST action=reset-session -> invalidates the session (session counter restarts)
 */
public class HitCounterServlet extends ApiServlet {
    private static final String SESSION_HITS = "campusnex.sessionHits";

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        boolean peek = "true".equalsIgnoreCase(req.getParameter("peek"));
        HttpSession session = req.getSession(true);
        AtomicInteger app = (AtomicInteger) getServletContext().getAttribute(AppStartListener.APP_HITS);

        int sessionHits;
        synchronized (session) {
            Integer stored = (Integer) session.getAttribute(SESSION_HITS);
            sessionHits = stored == null ? 0 : stored;
            if (!peek) {
                sessionHits++;
                session.setAttribute(SESSION_HITS, sessionHits);
            }
        }
        int appHits = peek ? app.get() : app.incrementAndGet();
        String startedAt = String.valueOf(getServletContext().getAttribute(AppStartListener.STARTED_AT));

        if ("html".equalsIgnoreCase(req.getParameter("format"))) {
            writeHtml(resp, sessionHits, appHits, session, startedAt);
            return;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("sessionHits", sessionHits);
        body.put("applicationHits", appHits);
        body.put("counted", !peek);
        body.put("sessionId", mask(session.getId()));
        body.put("newSession", session.isNew());
        body.put("applicationStartedAt", startedAt);
        json(resp, HttpServletResponse.SC_OK, body);
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        if ("reset-session".equals(req.getParameter("action"))) {
            HttpSession session = req.getSession(false);
            if (session != null) session.invalidate();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("reset", "session");
            body.put("message", "Session invalidated. The session counter will start again from 1.");
            json(resp, HttpServletResponse.SC_OK, body);
        } else {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("error", "Unknown action. Use action=reset-session.");
            json(resp, HttpServletResponse.SC_BAD_REQUEST, body);
        }
    }

    private void writeHtml(HttpServletResponse resp, int sessionHits, int appHits,
                           HttpSession session, String startedAt) throws IOException {
        resp.setContentType("text/html;charset=UTF-8");
        resp.setHeader("Cache-Control", "no-store");
        try (PrintWriter out = resp.getWriter()) {
            out.println("<!DOCTYPE html>");
            out.println("<html lang=\"en\"><head><meta charset=\"utf-8\">");
            out.println("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">");
            out.println("<title>CampusNex Servlet Hit Counter</title>");
            out.println("<style>body{font-family:Segoe UI,Arial,sans-serif;background:#eef4f1;color:#12292b;margin:0;"
                    + "display:grid;place-items:center;min-height:100vh}main{background:#fff;border:1px solid #c9dcd3;"
                    + "border-radius:12px;padding:2rem 2.5rem;max-width:34rem}h1{color:#0b3d3e;font-size:1.4rem;margin-top:0}"
                    + "dl{display:grid;grid-template-columns:auto 1fr;gap:.4rem 1.2rem}dt{color:#4b6b66}dd{margin:0;font-weight:600}"
                    + ".n{font-size:2rem;color:#14575a}</style></head><body><main>");
            out.println("<h1>CampusNex Servlet Hit Counter</h1>");
            out.println("<p>This page was generated dynamically by <code>HitCounterServlet</code> running on "
                    + Json.html(getServletContext().getServerInfo()) + ".</p>");
            out.println("<dl>");
            out.println("<dt>Session hits (this browser session)</dt><dd class=\"n\">" + sessionHits + "</dd>");
            out.println("<dt>Application hits (all visitors)</dt><dd class=\"n\">" + appHits + "</dd>");
            out.println("<dt>Session id</dt><dd>" + Json.html(mask(session.getId())) + "</dd>");
            out.println("<dt>Application started</dt><dd>" + Json.html(startedAt) + "</dd>");
            out.println("</dl><p>Reload this page to count another hit.</p></main></body></html>");
        }
    }
}
