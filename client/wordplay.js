////////// Main client application logic //////////

//////
////// Utility functions
//////

var player = function () {
  return Players.findOne(Session.get('player_id'));
};

var game = function () {
  var me = player();
  return me && me.game_id && Games.findOne(me.game_id);
};

var create_my_player = function (name) {
  // kill my bad words after 5 seconds.
  Words.find({player_id: Session.get('player_id'), state: 'bad'})
    .observe({
      added: function (word) {
        setTimeout(function () {
          $('#word_' + word._id).fadeOut(1000, function () {
            Words.remove(word._id);
          });
        }, 5000);
      }});
};

var set_selected_positions = function (word) {
  var paths = paths_for_word(game().board, word.toUpperCase());
  var in_a_path = [];
  var last_in_a_path = [];

  for (var i = 0; i < paths.length; i++) {
    in_a_path = in_a_path.concat(paths[i]);
    last_in_a_path.push(paths[i].slice(-1)[0]);
  }

  for (var pos = 0; pos < 16; pos++) {
    if (last_in_a_path.indexOf(pos) !== -1)
      Session.set('selected_' + pos, 'last_in_path');
    else if (in_a_path.indexOf(pos) !== -1)
      Session.set('selected_' + pos, 'in_path');
    else
      Session.set('selected_' + pos, false);
  }
};

var clear_selected_positions = function () {
  for (var pos = 0; pos < 16; pos++)
    Session.set('selected_' + pos, false);
};

Session.set('register', false);
//////
////// lobby template: shows everyone not currently playing, and

////// offers a button to start a fresh game.
//////
Template.top.current_player_name = function () {
    return Session.get("current_player_name");
}

Template.top.events =  {
    'click button.logout': function () {
        Session.set("current_player_name", undefined);
        Session.set("current_player_id", undefined);
    },
    'click button.register': function () {
        Session.set('register', true);
    },
    'click button.login': function () {
        Session.set('login', true);
    }
}

Template.top.registration = function () {
    // toggle between lobby and registration
    return Session.get('register');
}

Template.top.login = function () {
    // toggle between lobby and registration
    return Session.get('login');
}

Template.top.logged_out = function () {
    // toggle between lobby and registration
    if ( Session.get('login') || Session.get('register') || Session.get("current_player_name") ) {
        return false
    } else { return true };
}

Template.lobby.show = function () {
  // only show lobby if we're not in a game
  return !game() && !Session.get("roomView");
};

Template.lobby.waiting = function () {
  var players = Players.find({_id: {$ne: Session.get('player_id')},
                              name: {$ne: ''},
                              game_id: {$exists: false}});

  return players;
};

Template.lobby.count = function () {
  var players = Players.find({_id: {$ne: Session.get('player_id')},
                              name: {$ne: ''},
                              game_id: {$exists: false}});

  return players.count();
};

Template.lobby.disabled = function () {
  var me = player();
  if (me && me.name)
    return '';
  return 'disabled="disabled"';
};


Template.lobby.events = {
  'keyup input#myname': function (evt) {
    var name = $('#lobby input#myname').val().trim();
    Players.update(Session.get('player_id'), {$set: {name: name}});
  },
  'click button.startgame': function () {
    Meteor.call('start_new_game');
  }
};

Template.registration.events = {
    'click button.save_profile': function () {
        var name = $('#registration input#myname').val().trim();
        var password = $('#registration input#password').val().trim();
        Meteor.call('register_player', name, password, function (error, result) {
            if (error) {i
                console.log(error);
            } else {
                Session.set("current_player_name", result);
            };
        });
        Session.set('register', undefined);
    },
    'click button.lobby_return': function () {
        Session.set('register', false);
    }
}

Template.login.events = {
    'click button.login': function () {
        var name = $('#login input#myname').val().trim();
        var password = $('#login input#password').val().trim();
        Meteor.call('login_player', name, password, function (error, result) {
            if (error) {
                alert(error['reason']);
                console.log(error);
            } else {
                Session.set('current_player_name', result);
                Session.set('login', undefined);
                }
        });
    },
    'click button.lobby_return': function () {
        Session.set('login', false);
    }
}

/////
///// Create Room
/////

Template.roomlist.events = {
    'click button.createroom': function () {
        Session.set("createRoomModal", true);
        $("createRoomModal").modal('show');
    },
    'click a.room': function (evt) {
        var roomName = evt.target.id;
        router.navigate("room/" + roomName, {trigger: true, replace: true});
    }
}

Template.roomlist.rooms = function () {
   return Rooms.find( {} );
}

Template.createRoomModal.show = function () {
    return Session.get("createRoomModal");
}

Template.createRoomModal.events = {
    'click a#close': function () {
        $("createRoomModal").modal("hide");
        Session.set("createRoomModal", false);
    },
    'click a#create': function () {
        var newRoomName = $('#newRoomName').val().trim();
        var timelimit = parseInt($("input[name=timeLimit]:checked").attr("value"));
        Meteor.call("create_new_room", newRoomName, timelimit);
        $("createRoomModal").modal("hide");
        Session.set("createRoomModal", false);
    }
}

/////Room

Template.room.show = function () {
    return Session.get("roomView");
}

Template.room.events = {
    'click a#leave': function () {
        Session.set("roomView", undefined);
        Meteor.call("leave_room", Session.get("current_player_name"));
        router.navigate("lobby", {trigger: true, replace: true});
    },
    'click button#startgame': function () {
        var timelimit = 120;
        var room_name = Session.get("roomView");
        alert(room_name);
        Meteor.call('start_new_game', timelimit, room_name);
    }
}

//////
////// board template: renders the board and the clock given the
////// current game.  if there is no game, show a splash screen.
//////
var SPLASH = ['','','','',
              'W', 'O', 'R', 'D',
              'P', 'L', 'A', 'Y',
              '','','',''];

Template.board.square = function (i) {
  var g = game();
  return g && g.board && g.board[i] || SPLASH[i];
};

Template.board.selected = function (i) {
  return Session.get('selected_' + i);
};

Template.board.clock = function () {
  var clock = game() && game().clock;

  if (!clock || clock === 0)
    return;

  // format into M:SS
  var min = Math.floor(clock / 60);
  var sec = clock % 60;
  return min + ':' + (sec < 10 ? ('0' + sec) : sec);
};

Template.board.events = {
  'click .square': function (evt) {
    var textbox = $('#scratchpad input');
    textbox.val(textbox.val() + evt.target.innerHTML);
    textbox.focus();
  }
};

//////
////// scratchpad is where we enter new words.
//////

Template.scratchpad.show = function () {
  return game() && game().clock > 0;
};

Template.scratchpad.events = {
  'click button, keyup input': function (evt) {
    var textbox = $('#scratchpad input');
    // if we clicked the button or hit enter
    if (evt.type === "click" ||
        (evt.type === "keyup" && evt.which === 13)) {

      var word_id = Words.insert({player_id: Session.get('player_id'),
                                  game_id: game() && game()._id,
                                  word: textbox.val().toUpperCase(),
                                  state: 'pending'});
      Meteor.call('score_word', word_id);
      textbox.val('');
      textbox.focus();
      clear_selected_positions();
    } else {
      set_selected_positions(textbox.val());
    }
  }
};

Template.postgame.show = function () {
  return game() && game().clock === 0;
};

Template.postgame.events = {
  'click button': function (evt) {
    Players.update(Session.get('player_id'), {$set: {game_id: null}});
  }
}

//////
////// scores shows everyone's score and word list.
//////

Template.scores.show = function () {
  return !!game();
};

Template.scores.players = function () {
  return game() && game().players;
};

Template.player.winner = function () {
  var g = game();
  if (g.winners && _.include(g.winners, this._id))
    return 'winner';
  return '';
};

Template.player.total_score = function () {
  var words = Words.find({game_id: game() && game()._id,
                          player_id: this._id});

  var score = 0;
  words.forEach(function (word) {
    if (word.score)
      score += word.score;
  });
  return score;
};

Template.words.words = function () {
  return Words.find({game_id: game() && game()._id,
                    player_id: this._id});
};
// FIXME: make this a proper view!
Template.leaderboard.player_summaries = function () {
   return Players.find( {} );
   /* var players = Players.find( {} );

    players.forEach(function (player) {
        var total_games = 0
        var highest_score = 0
        var games = player["games"];
        total_games = Object.keys(games).length;

        all_scores = []
        games.forEach(function (game) {
            all_scores.push(game["score"]);
        });
        highest_score = Math.max.apply(Math, all_scores);
    });
   return players.fetch();*/
};

//////
////// jQuery Stuff
//////

$("#createRoomModal").modal();

//////
////// Initialization
//////

Meteor.startup(function () {
  // Allocate a new player id.
  //
  // XXX this does not handle hot reload. In the reload case,
  // Session.get('player_id') will return a real id. We should check for
  // a pre-existing player, and if it exists, make sure the server still
  // knows about us.
  //var player_id = Players.insert({name: '', idle: false});
  //Session.set('player_id', player_id);

  // subscribe to all the players, the game i'm in, and all
  // the words in that game.
  Meteor.autosubscribe(function () {
    Meteor.subscribe('players');

    if (Session.get('current_player_name')) {
        Meteor.subscribe('rooms');
    }

    if (Session.get('player_id')) {
      var me = player();
      if (me && me.game_id) {
        Meteor.subscribe('games', me.game_id);
        Meteor.subscribe('words', me.game_id, Session.get('player_id'));
      }
    }
  });

  // send keepalives so the server can tell when we go away.
  //
  // XXX this is not a great idiom. meteor server does not yet have a
  // way to expose connection status to user code. Once it does, this
  // code can go away.
  Meteor.setInterval(function() {
    if (Meteor.status().connected)
      Meteor.call('keepalive', Session.get('player_id'));
  }, 20*1000);
});
