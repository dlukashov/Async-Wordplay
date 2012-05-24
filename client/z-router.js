var Router = Backbone.Router.extend({
    routes: {
        "room/*slug": "room"
    },

    room: function (slug) {
        enter_room(slug);
    }
});

var router = new Router();

Meteor.startup(function () {
    Backbone.history.start({pushState: true});
});
