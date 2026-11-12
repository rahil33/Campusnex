# CampusNex: Interactive Campus Information and Student Utility Portal

Mini project for **CSD 3105 Internet and Web Programming Laboratory**
Mohammed Rahil, RRN 240071601104, CSE - B, 3rd Year

CampusNex combines ten laboratory experiments into one portal: a student sign-in page, a personalised
dashboard, a campus directory (HTML table), an interactive campus map, an automatic slideshow, a
network clock, and Java Servlet demonstrations (request/response, hit counter, static-to-dynamic).

* Frontend: HTML5, CSS3, vanilla JavaScript. No frameworks, no external libraries, no CDN.
* Backend: Java Servlet 6.0 (Jakarta EE 10) on Apache Tomcat 10.1+. No third-party Java libraries.

## 1. Project structure

```
campusnex/
  index.html            Login page (laboratory 7)
  dashboard.html        Dashboard: overview, gallery, map, directory, labs, about
  style.css             External stylesheet (laboratory 2)
  script.js             All client-side behaviour
  config.js             Backend URL setting (empty = same origin)
  assets/               Slideshow images (SVG) and favicon
  .vercelignore         Keeps the servlet folder out of the Vercel upload
  servlet/
    pom.xml             Maven build (WAR, bundles the frontend)
    build.sh            Build without Maven (Linux, macOS, Git Bash)
    build.bat           Build without Maven (Windows)
    src/main/java/com/campusnex/
      HelloServlet.java       /api/hello    request/response demo
      HitCounterServlet.java  /api/hits     session + application counters
      NoticesServlet.java     /api/notices  server-generated HTML fragment
      NtpTimeServlet.java     /api/ntp      real NTP time (UDP, server side)
      NtpClient.java          SNTP client used by NtpTimeServlet
      AppStartListener.java   creates application-wide counters at start-up
      CorsFilter.java         allows a separately hosted frontend
      ApiServlet.java, Json.java   shared helpers
    src/main/webapp/WEB-INF/web.xml   deployment descriptor
```

## 2. Requirements

| Item | Version |
|---|---|
| JDK | 17 or newer (developed and tested with 21) |
| Apache Tomcat | **10.1 or newer.** Tomcat 9 and older use `javax.*` and will not run this WAR |
| Maven | 3.8+ (optional; `build.sh` / `build.bat` work without it) |
| Browser | Current Chrome, Edge or Firefox |

## 3. Run it (recommended: everything on Tomcat)

Serving the pages and the servlets from the same Tomcat gives one origin, so the session cookie works
and every panel is fully functional.

### 3a. Build the WAR

Pick **one**:

```bash
# Maven
cd servlet
mvn clean package            # produces servlet/target/campusnex.war

# Linux / macOS / Git Bash, no Maven
cd servlet
./build.sh /path/to/apache-tomcat-10.1.x
```
```bat
:: Windows, no Maven
cd servlet
build.bat "C:\apache-tomcat-10.1.x"
```

### 3b. Deploy to Tomcat

1. Copy `servlet/target/campusnex.war` into `<TOMCAT_HOME>/webapps/`.
2. Start Tomcat: `bin\startup.bat` (Windows) or `bin/startup.sh` (Linux/macOS).
3. Open **http://localhost:8080/campusnex/**
4. Click **Use demo student details**, then **Sign in**.

Watch `logs/catalina.out` (or `logs\catalina.<date>.log`) for `CampusNex started`.
To stop: `bin\shutdown.bat` / `bin/shutdown.sh`.

### 3c. Quick check from a terminal

```bash
curl -i  http://localhost:8080/campusnex/api/hits                 # counts a hit, returns JSON
curl -i  "http://localhost:8080/campusnex/api/hello?name=Rahil"   # request/response demo
curl -i  http://localhost:8080/campusnex/api/ntp                  # NTP time (or system-clock fallback)
curl -i  "http://localhost:8080/campusnex/api/notices?name=Rahil" # server-generated HTML
```

## 4. Frontend only (no servlet), for design work

```bash
cd campusnex
python -m http.server 5500       # then open http://localhost:5500/
```

Everything except the servlet panels works. Those panels say "Servlet not reachable" and show the URL
they tried. They never show invented data.

## 5. Deploy the static frontend on Vercel (separate from Tomcat)

The frontend is plain static files, so Vercel needs no build step.

1. Put the `campusnex` folder in a GitHub repository (`.vercelignore` already excludes `servlet/`).
2. On vercel.com choose **Add New, Project**, import the repository.
3. Framework Preset: **Other**. Build Command: empty. Output Directory: `.` (project root).
4. Click **Deploy**. Your site is at `https://<project>.vercel.app/`.

Vercel hosts only HTML, CSS and JavaScript; it cannot run Java servlets. To use the servlet panels from
a Vercel-hosted site:

1. Deploy `campusnex.war` on a Tomcat reachable over **HTTPS** (a page served over HTTPS cannot call
   a plain `http://` backend: browsers block mixed content).
2. In `servlet/src/main/webapp/WEB-INF/web.xml` add your Vercel URL to the CorsFilter `allowedOrigins`
   (comma separated, no trailing slash), rebuild and redeploy.
3. On the dashboard open **Web Labs, Backend connection**, enter `https://your-tomcat-host/campusnex`
   and press **Save and test**. (Or set `apiBase` in `config.js` before deploying.)

**Known limitation of split hosting.** When the frontend and Tomcat are on different *sites*, browsers
withhold the `JSESSIONID` cookie from cross-site requests (SameSite rules). The **application** counter
still works, but the **session** counter will not increase. It would need `SameSite=None; Secure` cookies
on an HTTPS Tomcat. For the laboratory demonstration, use section 3 (same origin).

## 6. How each experiment is implemented

| No. | Experiment | Implementation |
|---|---|---|
| 1 | HTML table tags | Directory table: `caption`, `thead`, `tbody`, `tfoot`, `th scope`, `colspan`; filter by search and category |
| 2 | CSS | `style.css`: variables, grid/flexbox, media queries, hover and focus states, transitions, reusable components |
| 3 | Interactive map | HTML buttons over an inline SVG plan; selecting a pin or chip fills the info panel from the directory rows |
| 4 | W3C validator | Semantic HTML5; both pages and the servlet-generated page validated with the Nu Html Checker (section 8) |
| 5 | NTP clock | See below |
| 6 | Automatic slideshow | Auto-advance every 4.5 s, previous/next, dot indicators, pause/play, pause on hover, keyboard arrows |
| 7 | Login page | Field validation with messages, show/hide password, demo account; **demo authentication only** |
| 8 | Java Servlet | `HelloServlet` reads method, parameters and headers and returns JSON |
| 9 | Hit counter | `HitCounterServlet`: `HttpSession` counter and `ServletContext` counter |
| 10 | Static to dynamic | Static HTML box replaced first by JavaScript (DOM), then by an HTML fragment from `NoticesServlet` |

### NTP versus HTTP time (experiment 5)

* **NTP** is a UDP protocol on port 123. Browser JavaScript has no UDP access, so a web page **cannot**
  speak NTP.
* `NtpTimeServlet` performs a genuine SNTP exchange from the **server** using `NtpClient`
  (T1..T4 timestamps, offset = ((T2-T1)+(T3-T4))/2) and returns the corrected time. If the server cannot
  reach the NTP host (firewall, no internet) it says so and returns its own system clock.
* The browser tries, in order: (1) the servlet, (2) an HTTP time API (worldtimeapi.org, then timeapi.io),
  (3) the HTTP `Date` header of the site. The dashboard badge always names the source actually used:
  *NTP via Java servlet*, *Servlet host clock*, *HTTP time API*, *HTTP Date header* or *Device clock*.
  Only the first is NTP.
* The NTP host is set in `web.xml` (`ntpHost`, default `pool.ntp.org`). Results are cached for 60 seconds.

### Session counter versus application counter (experiment 9)

| | Session counter | Application counter |
|---|---|---|
| Stored in | `HttpSession` | `ServletContext` |
| Scope | One browser session (tied to `JSESSIONID`) | All visitors together |
| Resets when | Session expires (30 min) or **New session** is pressed | The web application restarts |

## 7. Customising

* **Directory and map data** are sample data in `dashboard.html` (table rows). Replace them with official
  information. The map and info panel read from the table, so one edit updates both.
* **Student details** in the "Prepared by" card are in `dashboard.html`.
* **Slideshow images** are illustrations in `assets/`. Replace with real photographs of your campus
  (keep the same file names, or edit the `<img>` tags).

## 8. Validating the HTML with the W3C service

1. Open https://validator.w3.org/
2. **Validate by URI** for the deployed site (`.../index.html`, `.../dashboard.html`), or
   **Validate by File Upload** for `index.html` and `dashboard.html`, or **Validate by Direct Input** and
   paste the code (the dashboard has a **Copy this page's HTML** button).
3. Press **Check** and screenshot the result.

The pages were also checked with the Nu Html Checker (the engine behind the W3C service), version 26.11.9:
`index.html`, `dashboard.html`, `style.css`, all SVG assets and the HTML page produced by
`HitCounterServlet` returned no errors and no warnings.

## 9. What was tested, and what was not

Tested in a Linux sandbox with Apache Tomcat 10.1.55, OpenJDK 21 and headless Chromium:

* Every servlet endpoint with `curl`, including session cookie behaviour, reset, CORS allow and deny.
* The NTP packet exchange against a local mock NTP server that was 2000 ms ahead (offset detected and
  applied). Real `pool.ntp.org` was **not reachable** from the sandbox, so the live-NTP badge was not seen
  against a public server there.
* 91 automated browser checks: login validation, navigation, every map pin and chip, directory filters,
  slideshow auto-advance/controls/pause, clock ticking, servlet GET/POST, hit counters, static-to-dynamic,
  backend settings, sign-out, frontend-only mode (servlet absent), cross-origin mode, and a 390 px phone width.
* Same-site versus cross-site session cookies (section 5).

**Not tested:** the Maven build (`pom.xml`; Maven Central was not reachable from the sandbox; `build.sh`
was tested), `build.bat` on Windows, a real Vercel deployment, and the W3C web service itself. Treat those
as to be verified on your machine, and use the screenshots checklist.

## 10. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Chip says **Servlet: offline** | Tomcat is not running, the WAR is not deployed, or the URL is wrong. Open `http://localhost:8080/campusnex/api/hits` directly |
| `HTTP Status 404` for `/campusnex/` | WAR not unpacked yet. Wait a few seconds and check the Tomcat log for errors |
| `ClassNotFoundException: javax.servlet...` or deployment errors | You are on Tomcat 9 or older. Use Tomcat 10.1+ |
| Port 8080 already in use | Change the HTTP connector port in `conf/server.xml` |
| Clock says *Servlet host clock* | The server could not reach the NTP host (UDP 123 blocked or no internet) |
| Cross-origin calls blocked | Add your frontend origin to `allowedOrigins` in `web.xml`, redeploy |
| Session counter stuck at 1 on Vercel | Cross-site cookie limitation (section 5) |
