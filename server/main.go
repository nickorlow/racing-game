package main 

import (
    "log"
    "net/http"
    "fmt"
    "github.com/gorilla/websocket"
    "racer/server/pb"
)

var upgrader = websocket.Upgrader{}
var todoList []string

func main() {
    vec := &pb.Vector{
        X: 1.1,
        Y: 4.2,
        Z: 4.2,
    }
    log.Print(vec)
    http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
        // Upgrade upgrades the HTTP server connection to the WebSocket protocol.
        conn, err := upgrader.Upgrade(w, r, nil)
        if err != nil {
            log.Print("upgrade failed: ", err)
            return
        }
        defer conn.Close()

        for {
            mt, message, err := conn.ReadMessage()
            if err != nil {
                log.Println("read failed:", err)
                break
            }
            input := string(message)
            log.Println(input)
            output := "No More ?'s\n"
            message = []byte(output)
            err = conn.WriteMessage(mt, message)

            if err != nil {
                log.Println("write failed:", err)
                break
            }
        }
    })

    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Welcome to my website!")
    })

    http.ListenAndServe(":8080", nil)
}
