package main 

import (
    "log"
    "net/http"
    "fmt"
    "strings"
    "time"
    "racer/server/pb"
)

var todoList []string

func main() {
    vec := &pb.Vector{
        X: 1.1,
        Y: 4.2,
        Z: 4.2,
    }

    log.Print(vec)

	hub := newHub()
	go hub.run()
	http.HandleFunc("/ws/", func(w http.ResponseWriter, r *http.Request) {
        id := strings.TrimPrefix(r.URL.Path, "/ws/")
        log.Println(id)
		serveWs(hub, w, r)
	})
    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Welcome to my website!")
    })

	server := &http.Server{
        Addr:              "localhost:8080",
		ReadHeaderTimeout: 3 * time.Second,
	}

	err := server.ListenAndServe()
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
