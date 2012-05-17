var Router = Backbone.Router.extend({
    routes: {
        "room/*name": "room"
    },

    room: function (name) {
        console.log("HI!");
        var room = Rooms.find( {name: name} ).fetch()[0];
        Session.set("roomView", room._id);
        Template.room.roomInfo = function () {
            return room;
        }
    }
});

var router = new Router();

Backbone.history.start({pushState: true});
