/* CampusNex runtime configuration.
 *
 * apiBase = ""  -> the page and the Java servlets are served by the same Tomcat
 *                  (recommended; sessions and the hit counter work fully).
 * apiBase = "https://your-tomcat-host/campusnex" -> frontend hosted elsewhere
 *                  (for example Vercel) calling a separately deployed Tomcat.
 *
 * The URL can also be changed at run time in Dashboard > Web Labs > Backend connection.
 */
window.CAMPUSNEX_CONFIG = {
  apiBase: ""
};
