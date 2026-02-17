require("dotenv").config()



// creating mongodb connection configurations

const conne_user = process.env.conne_user || 'cok_systems'
const conne_password = process.env.conne_password || 'kigalicity'
const conne_app_name = process.env.conne_app_name || 'cok_systems'
const dev_mode_conne_string = `mongodb+srv://${conne_user}:${conne_password}@${conne_user}.rldhlb3.mongodb.net/?appName=${conne_app_name}`
const conne_string = process.env.conne_string || dev_mode_conne_string


