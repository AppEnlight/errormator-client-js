(function (window) {
    "use strict";

    var AppEnlight = {
        version: '0.4.1',
        options: {
            apiKey: ""
        },
        errorReportBuffer: [],
        slowReportBuffer: [],
        logBuffer: [],
        requestInfo: null,

        init: function (options) {
            var self = this;
            if (typeof options.server === 'undefined') {
                options.server = "https://api.appenlight.com";
            }
            if (typeof options.apiKey === 'undefined') {
                options.apiKey = "undefined";
            }
            if (typeof options.protocol_version === 'undefined') {
                options.protocol_version = "0.5";
            }
            if (typeof options.windowOnError === 'undefined' ||
                options.windowOnError === false) {
                TraceKit.collectWindowErrors = false;
            }
            if (typeof options.sendInterval === 'undefined') {
                options.sendInterval = 1000;
            }
            if (typeof options.tracekitRemoteFetching === 'undefined') {
                options.tracekitRemoteFetching = true;
            }
            if (typeof options.tracekitContextLines === 'undefined') {
                options.tracekitContextLines = 11;
            }
            if (options.sendInterval >= 1000) {
                this.createSendInterval(options.sendInterval);
            }
            this.options = options;
            this.requestInfo = { url: window.location.href };
            this.reportsEndpoint = options.server +
                '/api/reports?public_api_key=' + this.options.apiKey +
                "&protocol_version=" + this.options.protocol_version;
            this.logsEndpoint = options.server +
                '/api/logs?public_api_key=' + this.options.apiKey +
                "&protocol_version=" + this.options.protocol_version;

            TraceKit.remoteFetching = options.tracekitRemoteFetching;
            TraceKit.linesOfContext = options.tracekitContextLines;
            TraceKit.report.subscribe(function (errorReport) {
                self.handleError(errorReport);
            });
        },

        createSendInterval: function (time_iv) {
            var self = this;
            this.send_iv = setInterval(function () {
                self.sendReports();
                self.sendLogs();
            }, time_iv);
        },

        setRequestInfo: function (info) {
            for (var i in info) {
                this.requestInfo[i] = info[i];
            }
        },

        grabError: function (exception) {
            // we need to catch rethrown exception but throw an error from TraceKit
            try {
                TraceKit.report(exception);
            } catch (new_exception) {
                if (exception !== new_exception) {
                    throw new_exception;
                }
            }

        },

        handleError: function (errorReport) {
            var error_msg = '';
            if (errorReport.mode == 'stack') {
                error_msg = errorReport.name + ': ' + errorReport.message;
            }
            else {
                error_msg = errorReport.message;
            }
            var report = {
                "client": "javascript",
                "language": "javascript",
                "error": error_msg,
                "occurences": 1,
                "priority": 5,
                "server": '',
                "http_status": 500,
                "request": {},
                "traceback": [],
            };
            report.user_agent = window.navigator.userAgent;
            report.start_time = new Date().toJSON();

            if (this.requestInfo !== null) {
                for (var i in this.requestInfo) {
                    report[i] = this.requestInfo[i];
                }
            }

            if (typeof report.request_id == 'undefined' || !report.request_id) {
                report.request_id = this.genUUID4();
            }
            // grab last 100 frames in reversed order
            var stack_slice = errorReport.stack.reverse().slice(-100);
            for (var i = 0; i < stack_slice.length; i++) {
                var context = '';
                try{
                    if (stack_slice[i].context){
                        for(var j = 0; j < stack_slice[i].context.length; j++){
                            var line = stack_slice[i].context[j];
                            if (line.length > 300){
                                context += '<minified-context>';
                            }
                            else{
                                context += line;
                            }
                            context += '\n';
                        }
                    }
                }
                catch(e){}
                var stackline = {'cline': context,
                    'file': stack_slice[i].url,
                    'fn': stack_slice[i].func,
                    'line': stack_slice[i].line,
                    'vars': []};
                report.traceback.push(stackline);
            }
            if(report.traceback.length > 0){
                var lastFrameContext = stack_slice[i][-1].context;
                report.traceback[report.traceback.length - 1].cline = lastFrameContext + '\n' + error_msg;
            }
            this.errorReportBuffer.push(report);
        },
        log: function (level, message, namespace, uuid) {
            if (typeof namespace == 'undefined') {
                namespace = window.location.pathname;
            }
            if (typeof uuid == 'undefined') {
                uuid = null;
            }
            this.logBuffer.push(
                {
                    "log_level": level.toUpperCase(),
                    "message": message,
                    "date": new Date().toJSON(),
                    "namespace": namespace
                });
            if (this.requestInfo !== null && typeof this.requestInfo.server != 'undefined') {
                this.logBuffer[this.logBuffer.length - 1].server = this.requestInfo.server;
            }
        },

        genUUID4: function () {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
                /[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : r & 0x3 | 0x8;
                    return v.toString(16);
                }
            );
        },

        sendReports: function () {
            if (this.errorReportBuffer.length < 1) {
                return true;
            }
            var data = this.errorReportBuffer;
            this.submitData(this.reportsEndpoint, data);
            this.errorReportBuffer = [];
            return true;
        },
        sendLogs: function () {
            if (this.logBuffer.length < 1) {
                return true;
            }
            var data = this.logBuffer;
            this.submitData(this.logsEndpoint, data);
            this.logBuffer = [];
            return true;
        },

        submitData: function (endpoint, data) {
            var xhr = new window.XMLHttpRequest();
            if (!xhr && window.ActiveXObject) {
                xhr = new window.ActiveXObject("Microsoft.XMLHTTP");
            }
            xhr.open("POST", endpoint, true);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.send(JSON.stringify(data));
        }
    };
    window.AppEnlight = AppEnlight;

    if ( typeof define === "function" && define.amd ) {
        define( "appenlight", [], function() {
            return AppEnlight;
        });
    }

}(window));
