package main 

import (
    "log"
    "net/http"
    "fmt"
    "time"
    "io/ioutil"
    "racer/server/pb"
    "github.com/golang/protobuf/proto"
)

var todoList []string

func main() {
    init_db();

	hub := newHub()
	go hub.run()

	fs := http.FileServer(http.Dir("/k/sv/racing-game/frontend"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))
	
	http.HandleFunc("/ws/", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})
    
    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Welcome to my website!")
    })

    // Create room
    http.HandleFunc("/room", func(w http.ResponseWriter, r *http.Request) {
        if (r.Method == http.MethodPost) {
            roomCreation := pb.RoomCreationRequest{} 
            data, err := ioutil.ReadAll(r.Body)

            if err != nil {
                fmt.Println(err)
            }

            if err := proto.Unmarshal(data, &roomCreation); err != nil {
                fmt.Println(err)
            }

            fmt.Println(roomCreation)

            room := get_new_room(roomCreation.Name)
            respObj, err := proto.Marshal(&room)
            if err != nil {
            	log.Fatalf("Unable to marshal response : %v", err)
            }
			fmt.Println(respObj)
            w.Write(respObj)
        } else {
            http.Error(w, "Method not allowed. WOMP WOMP", http.StatusMethodNotAllowed)
        }
    })
   
    // Add images
    http.HandleFunc("/room/images", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Welcome to my website!")
    })

	server := &http.Server{
        Addr:              "0.0.0.0:8080",
		ReadHeaderTimeout: 3 * time.Second,
	}

	err := server.ListenAndServe()
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
