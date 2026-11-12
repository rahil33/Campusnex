#!/usr/bin/env bash
# Builds campusnex.war without Maven (JDK 17+ and a Tomcat 10.1+ installation required).
# Usage:  ./build.sh /path/to/apache-tomcat-10.1.x      (Linux/macOS/Git Bash)
set -euo pipefail
TOMCAT_HOME="${1:-${CATALINA_HOME:-}}"
SERVLET_JAR="${SERVLET_API_JAR:-$TOMCAT_HOME/lib/servlet-api.jar}"
[ -f "$SERVLET_JAR" ] || { echo "servlet-api.jar not found. Pass the Tomcat folder as the first argument."; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/target"
rm -rf "$OUT" && mkdir -p "$OUT/war/WEB-INF/classes"

javac --release 17 -encoding UTF-8 -cp "$SERVLET_JAR" -d "$OUT/war/WEB-INF/classes" \
      $(find "$HERE/src/main/java" -name '*.java')

cp "$HERE/src/main/webapp/WEB-INF/web.xml" "$OUT/war/WEB-INF/"
FRONT="$HERE/.."
cp "$FRONT/index.html" "$FRONT/dashboard.html" "$FRONT/style.css" "$FRONT/script.js" "$FRONT/config.js" "$OUT/war/"
cp -r "$FRONT/assets" "$OUT/war/assets"

( cd "$OUT/war" && jar cf "$OUT/campusnex.war" . )
echo "Built: $OUT/campusnex.war"
