var Router = Backbone.Router.extend({
    routes: {
        "room/*name": "room"
    },

    room: function (name) {
        var room = Rooms.findOne( {name: name} );
        Session.set("roomView", room._id);
        Meteor.call("enter_room", room.name, Session.get("current_player_name"));
        Template.room.roomInfo = function () {
            return room;
        }
        Template.room.players = function () {
            return Players.find( {_current_room: room.name}).fetch()
        }
    }
});

var router = new Router();

Backbone.history.start({pushState: true});
