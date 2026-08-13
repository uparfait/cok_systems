const swaggerJSDoc = require("swagger-jsdoc");

const swagger_options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "COK Data Collection System API",
      version: "1.0.0",
      description: "Projects, forms, versions and submissions for the Data Collection System (dc_backend)",
    },
    servers: [{ url: "/dcs/api" }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./routes/**/*.js"],
};

module.exports = swaggerJSDoc(swagger_options);
