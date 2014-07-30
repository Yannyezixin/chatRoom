function Room(name, id, owner) {
    this.name = name;
    this.id = id;
    this.owner = owner;
    this.people = [];
    this.peopleLimit = 4;
    this.status = 'available';
    this.private = false;
};

Room.prototype.addPerson = function(personID) {
    if (this.status === 'available') {
        this.people.push(personID);
    }
};

module.exports = Room;
