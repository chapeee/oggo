module.exports = {
  ...require("./devtools/ssl-monitor-service"),
  ...require("./devtools/dns-monitor-service"),
  ...require("./devtools/port-monitor-service"),
  ...require("./devtools/env-vars-service"),
  ...require("./devtools/http-checks-service"),
};
