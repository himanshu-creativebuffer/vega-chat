module.exports = {
    apps : [{
        name   : "VEGA Chat",
        script : "npm",
        args: "run dev",
        watch: ["."],
        watch_delay: 1000,
        ignore_watch: ["node_modules"]
    }]
}