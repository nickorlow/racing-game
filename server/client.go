package main

import (
	"bytes"
	"log"
	"net/http"
	"time"
    "strings"
    "strconv"
    "math/rand"

	"github.com/gorilla/websocket"
)

const (
	writeWait = 10 * time.Second
	pongWait = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
	maxMessageSize = 512
)

var (
	newline = []byte{'\n'}
	space   = []byte{' '}
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type Client struct {
	hub *Hub
	conn *websocket.Conn
	send chan Envelope
    room_id uint32
    id uint32
}

type Envelope struct {
    message []byte
    room_id uint32
    sender_id uint32
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		message = bytes.TrimSpace(bytes.Replace(message, newline, space, -1))
		log.Printf(string(message))
        envelope := Envelope{message: message, room_id: c.room_id, sender_id: c.id} 
		c.hub.broadcast <-envelope 
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case envelope, ok := <-c.send:
            message := envelope.message
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

            if c.room_id == envelope.room_id && c.id != envelope.sender_id {
			    w, err := c.conn.NextWriter(websocket.TextMessage)
			    if err != nil {
			    	return
			    }
                
			    w.Write(message)
            n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write(newline)
                envelope, ok = <-c.send
                if c.room_id == envelope.room_id && c.id != envelope.sender_id {
			    	w.Write(envelope.message)
                }
			}

			if err := w.Close(); err != nil {
				return
			}
            }


		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

    id := strings.TrimPrefix(r.URL.Path, "/ws/")
    room_id_long, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		log.Println(err)
		return
	}
    room_id_32 := uint32(room_id_long)

    client := &Client{hub: hub, conn: conn, send: make(chan Envelope, 256), room_id: room_id_32, id: rand.Uint32()} // 1/4b chance broken but whatever
	client.hub.register <- client

	//ws_w, _ := client.conn.NextWriter(websocket.TextMessage)
    //ws_w.Write([]byte(strconv.FormatUint(uint64(client.id), 10)))


	go client.writePump()
	go client.readPump()
}
