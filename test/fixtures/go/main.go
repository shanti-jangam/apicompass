package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	r.GET("/users", getUsers)
	r.POST("/users", createUser)
	r.GET("/users/:id", getUser)
	r.PUT("/users/:id", updateUser)
	r.DELETE("/users/:id", deleteUser)

	r.GET(
		"/statistics",
		getStatistics,
	)

	http.HandleFunc("/health", healthHandler)
}

func getUsers(c *gin.Context)     {}
func createUser(c *gin.Context)  {}
func getUser(c *gin.Context)     {}
func updateUser(c *gin.Context)  {}
func deleteUser(c *gin.Context)  {}
func getStatistics(c *gin.Context) {}
func healthHandler(w http.ResponseWriter, r *http.Request) {}
