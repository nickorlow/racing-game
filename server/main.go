package main 

import (
    "log"
    "net/http"
    "strconv"
    "fmt"
    "time"
    "io/ioutil"
    "io"
    "racer/server/pb"
    "reflect"
    "strings"
    "os"
    "os/exec"
    //"github.com/golang/protobuf/proto"
	"encoding/json"
)

func main() {
    init_db();

	hub := newHub()
	go hub.run()

	fs := http.FileServer(http.Dir("../frontend"))
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

            if err := json.Unmarshal(data, &roomCreation); err != nil {
                fmt.Println(err)
            }

            fmt.Println(roomCreation)

            room := get_new_room(roomCreation.Name)
            respObj, err := json.Marshal(&room)
            log.Println(room.Id)
            if err != nil {
            	log.Fatalf("Unable to marshal response : %v", err)
            }
			fmt.Println(respObj)
            w.Write(respObj)
        } else {
            http.Error(w, "Method not allowed. WOMP WOMP", http.StatusMethodNotAllowed)
        }
    })

    // Get list of existing rooms
    http.HandleFunc("/rooms", func(w http.ResponseWriter, r *http.Request) {
        if (r.Method == http.MethodGet) {
            txn := db.Txn(false)
            defer txn.Abort()
            it, err := txn.Get("rooms", "id")
            if err != nil {
                log.Fatalf("Unable to marshal response : %v", err)
            }
            var rooms[] pb.Room
            for obj := it.Next(); obj != nil; obj = it.Next() {
                p := obj.(pb.Room)
                rooms = append(rooms, p)
            }
            fmt.Println(rooms)
            respObj, err := json.Marshal(&rooms)
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusOK)
            w.Write(respObj)

        } else {
            http.Error(w, "Method not allowed. WOMP WOMP", http.StatusMethodNotAllowed)
        }
    })
   
    // Add images
    http.HandleFunc("/room/images/", func(w http.ResponseWriter, r *http.Request) {
        if (r.Method == http.MethodPost) {
            id := strings.TrimPrefix(r.URL.Path, "/room/images/")
            room_id_l, err := strconv.ParseUint(id, 10, 32)
	        if err != nil {
	        	log.Println(err)
	        	return
	        }

            room_id_32 := uint32(room_id_l)

            r.ParseMultipartForm(128 << 20) // 32MB is the default used by FormFile

            fhs := r.MultipartForm.File["image_uploads"]
            dname := "./images_"+ strconv.FormatUint(uint64(room_id_32), 10)
            err = os.Mkdir(dname, os.ModeDir)
            dnameobj := "./obj_"+ strconv.FormatUint(uint64(room_id_32), 10)
            err = os.Mkdir(dnameobj, os.ModeDir)
            log.Println(dname)
            for _, fh := range fhs {
                log.Println(reflect.TypeOf(fh))
                f, err := fh.Open()
                if err != nil {
                    log.Fatal("boo hoo")
                }

                log.Println(dname) 
                outFile, err := os.Create(dname+"/"+fh.Filename)
                defer outFile.Close()
                _, err = io.Copy(outFile, f)
            }

            set_room_state(room_id_32, pb.RoomState_GENERATING);
            hub.broadcast <- Envelope{message: []byte("GEN"), sender_id: 0, room_id: room_id_32}

            // the id is just 000 since we don't need an id anctually 
            cmd := exec.Command("python3", "../scene_recreation/run_dust3r.py", "--images_folder", dname, "--dust3r_path", "../scene_recreation/dust3r", "--out_dir", dnameobj, "--id", "0")
            out, err := cmd.CombinedOutput()
            log.Println(string(out))
            
            set_room_state(room_id_32, pb.RoomState_LOBBY);
            hub.broadcast <- Envelope{message: []byte("LBY"), sender_id: 0, room_id: room_id_32}

            if err != nil {
                http.Error(w, "Couldn't generate image. WOMP WOMP, cry about it", http.StatusInternalServerError)
            }

        } else {
            http.Error(w, "Method not allowed. WOMP WOMP", http.StatusMethodNotAllowed)
        }
    })
    
    http.HandleFunc("/room/pc_map/", func(w http.ResponseWriter, r *http.Request) {
            id := strings.TrimPrefix(r.URL.Path, "/room/pc_map/")
            room_id_l, err := strconv.ParseUint(id, 10, 32)
	        if err != nil {
	        	log.Println(err)
	        	return
	        }

            room_id_32 := uint32(room_id_l)
            f, err := os.Open("./obj_"+ strconv.FormatUint(uint64(room_id_32), 10)+"/pcd0.pcd")
	        if err != nil {
	        	log.Println(err)
	        	return
	        }
            fileBytes, err := ioutil.ReadAll(f)
	        if err != nil {
	        	log.Println(err)
	        	return
	        }
            w.Write(fileBytes)
    })
    
    http.HandleFunc("/room/mesh_map/", func(w http.ResponseWriter, r *http.Request) {
            id := strings.TrimPrefix(r.URL.Path, "/room/mesh_map/")
            room_id_l, err := strconv.ParseUint(id, 10, 32)
	        if err != nil {
	        	log.Println(err)
	        	return
	        }

            room_id_32 := uint32(room_id_l)
            f, err := os.Open("./obj_"+ strconv.FormatUint(uint64(room_id_32), 10)+"/mesh0.glb")
	        if err != nil {
	        	log.Println(err)
	        	return
	        }
            fileBytes, err := ioutil.ReadAll(f)
	        if err != nil {
	        	log.Println(err)
	        	return
	        }
            w.Write(fileBytes)
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
