package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
)

func main() {
	app := fiber.New()

	app.Static("/", "./public")

	app.Get("*", func(c *fiber.Ctx) error {
		return c.SendFile("./public/index.html")
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("Wordle server listening on http://localhost:%s", port)
	log.Fatal(app.Listen(":" + port))
}
