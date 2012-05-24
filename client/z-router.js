var Router = Backbone.Router.extend({
    routes: {
        "room/*name": "room"
    },

    room: function (name) {
        var room = Rooms.findOne( {name: name} );
        Session.set("roomView", name);
        Meteor.call("enter_room", name, Session.get("current_player_name"));
        Template.room.roomInfo = function () {
            return Rooms.findOne( {name: name} );
        }
        Template.room.players = function () {
            return Players.find( {_current_room: name}).fetch()
        }
    }
});

var router = new Router();

Backbone.history.start({pushState: true});
