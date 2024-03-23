package main

import (
    "github.com/hashicorp/go-memdb"
    "math/rand"
    "racer/server/pb"
)

var db *memdb.MemDB

func init_db() {
	schema := &memdb.DBSchema{
		Tables: map[string]*memdb.TableSchema{
			"rooms": &memdb.TableSchema{
				Name: "rooms",
				Indexes: map[string]*memdb.IndexSchema{
					"id": &memdb.IndexSchema{
						Name:    "id",
						Unique:  true,
						Indexer: &memdb.UintFieldIndex{Field: "Id"},
					},
					"name": &memdb.IndexSchema{
						Name:    "name",
						Unique:  false,
						Indexer: &memdb.StringFieldIndex{Field: "Name"},
					},
					"state": &memdb.IndexSchema{
						Name:    "state",
						Unique:  false,
						Indexer: &memdb.IntFieldIndex{Field: "State"},
					},
				},
			},
		},
	}
    cdb, err := memdb.NewMemDB(schema)
    db = cdb
	if err != nil {
		panic(err)
	}
}

func get_new_room(name string) pb.Room {
    txn := db.Txn(true)

    id := rand.Uint32() 
    room := pb.Room{Id: id, Name: name, State: 	0 };
	if err := txn.Insert("rooms", room); err != nil {
		panic(err)
	}

	txn.Commit()
    return room;
}

func set_room_state(id uint32, state int32) {
    txn := db.Txn(true)

    rawRoom, err := txn.First("rooms", "id", id);
    if err != nil {
		panic(err)
    }

    room := rawRoom.(*pb.Room)

    if err := txn.Delete("rooms", pb.Room{Id: id}); err != nil {
		panic(err)
	}

    room.State = state
    
	if err := txn.Insert("rooms", room); err != nil {
		panic(err)
	}

	txn.Commit()
}
