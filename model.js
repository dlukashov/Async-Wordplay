////////// Shared code (client and server) //////////

Games = new Meteor.Collection('games');
// { board: ['A','I',...], clock: 60,
//   players: [{player_id, name}], winners: [player_id] }

Words = new Meteor.Collection('words');
// {player_id: 10, game_id: 123, word: 'hello', state: 'good', score: 4}

Players = new Meteor.Collection('players');
// {name: 'matt', game_id: 123}

Rooms = new Meteor.Collection('rooms');
// {name: 'foo', room_id: 1}

if(Meteor.is_server) {
    var Game = new Schema({
        game_id : String
      , score : { type : Number, min: 0 }
    });

    //Player Schema
    var Player = new Schema({
        _id : String
      , name : String
      , password : String
      , games : [Game]
      , idle : { type: Boolean, default: false }
      , logged_in : { type: Boolean, default: true }
      , last_keepalive : Number
      , date_created : { type: Date, default: Date.now }
      , _current_room : { type: Schema.ObjectId, ref: 'Room' }
    });

    Player.statics.findAndModify = function (query, sort, doc, options, callback) {
        return this.collection.findAndModify(query, sort, doc, options, callback);
    };

    var Player = mongoose.model("Players", Player);

    //Player Related Methods
    Meteor.methods({
        register_player: function (name, password) {
        //FIXME: have to actually hash the passwords
            var new_player = new Player();
            new_player.name = name;
            new_player.password = password;
            new_player.save(function (err) {
                //return err;
            });
            return new_player.name
        },
        login_player: function(name, password) {
            //FIXME update to findAndModify, if and when possible
            //FIXME use bcrypt library to has passwords
            Player.update( {name: name, password: password}, {$set: {logged_in: true}}, [], function (err, numAffected) {
                if (err) {
                    console.log(err);
                } else if( numAffected > 1) {
                    console.log(numAffected);
                };
            });

            var logged_in_player = Players.findOne( {name: name, password: password, logged_in: true});

            if (!logged_in_player) {
                throw new Meteor.Error(404, "Account not found");
            } else {
                return logged_in_player;
            }
        },
        logout_player: function (player_id) {
            Player.update( {_id: player_id}, {$set: {logged_in: false}}, [], function (err, numAffected) {
                if (err) {
                    console.log(err);
                } else if( numAffected > 1) {
                    console.log(numAffected);
                };
            });
        }

    });


    var Room = new Schema({
        _id : String
      , name : String
      , slug: {type: String, set: slugify, }
      , date_created : { type: Date, default: Date.now }
      , active : { type: Boolean, default: true }
      , players : [{ type: Schema.ObjectId, ref: 'Player' }]
      , options : {
            timelimit : { type: Number, min: 0 }
          , width : { type: Number, min: 0, max: 16, default: 4 }
          , height : { type: Number, min: 0, max: 16, default: 4 }
      }
    });

    var Room = mongoose.model("Rooms", Room);

    Meteor.methods({
        create_new_room: function (name, timelimit) {
            var new_room = new Room();
            new_room.name = name;
            new_room.slug = name;
            new_room.options.timelimit = timelimit;
            new_room.save(function (err) {
                return err;
            });
        },
        enter_room: function (room_slug, player_name) {
            Players.update( {name: player_name}, {$set : {_current_room: room_slug}})

            var room = Rooms.findOne({slug: room_slug});
            if (!room) {
                throw new Meteor.Error(404, "Room could not be found");
                return false;
            } else {
                return room;
            }
        },
        leave_room: function (player_name) {
            Players.update( {name: player_name}, {$unset : {_current_room: 1}})
        }
    });
}

// 6 faces per die, 16 dice.  Q really means Qu.
var DICE = ['PCHOAS', 'OATTOW', 'LRYTTE', 'VTHRWE',
            'EGHWNE', 'SEOTIS', 'ANAEEG', 'IDSYTT',
            'MTOICU', 'AFPKFS', 'XLDERI', 'ENSIEU',
            'YLDEVR', 'ZNRNHL', 'NMIQHU', 'OBBAOJ'];

// board is an array of length 16, in row-major order.  ADJACENCIES
// lists the board positions adjacent to each board position.
var ADJACENCIES = [
  [1,4,5],
  [0,2,4,5,6],
  [1,3,5,6,7],
  [2,6,7],
  [0,1,5,8,9],
  [0,1,2,4,6,8,9,10],
  [1,2,3,5,7,9,10,11],
  [2,3,6,10,11],
  [4,5,9,12,13],
  [4,5,6,8,10,12,13,14],
  [5,6,7,9,11,13,14,15],
  [6,7,10,14,15],
  [8,9,13],
  [8,9,10,12,14],
  [9,10,11,13,15],
  [10,11,14]
];

// generate a new random selection of letters.
var new_board = function () {
  var board = [];
  var i;

  // pick random letter from each die
  for (i = 0; i < 16; i += 1) {
    board[i] = DICE[i].split('')[Math.floor(Math.random() * 6)];
  }

  // knuth shuffle
  for (i = 15; i > 0; i -= 1) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = board[i];
    board[i] = board[j];
    board[j] = tmp;
  }

  return board;
};

// returns an array of valid paths to make the specified word on the
// board.  each path is an array of board positions 0-15.  a valid
// path can use each position only once, and each position must be
// adjacent to the previous position.
var paths_for_word = function (board, word) {
  var valid_paths = [];

  var check_path = function (word, path, positions_to_try) {
    // base case: the whole word has been consumed.  path is valid.
    if (word.length === 0) {
      valid_paths.push(path);
      return;
    }


    // otherwise, try to match each available position against the
    // first letter of the word, avoiding any positions that are
    // already used by the path.  for each of those matches, descend
    // recursively, passing the remainder of the word, the accumulated
    // path, and the positions adjacent to the match.

    for (var i = 0; i < positions_to_try.length; i++) {
      var pos = positions_to_try[i];
      if (board[pos] === word[0] && path.indexOf(pos) === -1)
        check_path(word.slice(1),      // cdr of word
                   path.concat([pos]), // append matching loc to path
                   ADJACENCIES[pos]);  // only look at surrounding tiles
    }
  };

  // start recursive search w/ full word, empty path, and all tiles
  // available for the first letter.
  check_path(word, [], [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);

  return valid_paths;
};

Meteor.methods({
  score_word: function (word_id) {
    var word = Words.findOne(word_id);
    var game = Games.findOne(word.game_id);

    // client and server can both check: must be at least three chars
    // long, not already used, and possible to make on the board.
    if (word.length < 3
        || Words.find({game_id: word.game_id, word: word.word}).count() > 1
        || paths_for_word(game.board, word.word).length === 0) {
      Words.update(word._id, {$set: {score: 0, state: 'bad'}});
      return;
    }

    // now only on the server, check against dictionary and score it.
    if (Meteor.is_server) {
      if (DICTIONARY.indexOf(word.word.toLowerCase()) === -1) {
        Words.update(word._id, {$set: {score: 0, state: 'bad'}});
      } else {
        var score = Math.pow(2, word.word.length - 3);
        Words.update(word._id, {$set: {score: score, state: 'good'}});
      }
    }
  }
});


if (Meteor.is_server) {
  // publish all the non-idle players.
  Meteor.publish('players', function () {
    return Players.find({idle: false});
  });

  // publish single games
  Meteor.publish('games', function (id) {
    return Games.find({_id: id});
  });

  Meteor.publish('rooms', function () {
    return Rooms.find({active: true});
  });

  // publish all my words and opponents' words that the server has
  // scored as good.
  Meteor.publish('words', function (game_id, player_id) {
    return Words.find({$or: [{game_id: game_id, state: 'good'},
                             {player_id: player_id}]});
  });
}
