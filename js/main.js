var FIREBASE_CONFIG = {
  apiKey: "AIzaSyAXFut5TFrXjMpKsONlAChmkN9resG4Yqc",
  authDomain: "voteapp-aef90.firebaseapp.com",
  databaseURL: "https://voteapp-aef90.firebaseio.com",
  projectId: "voteapp-aef90",
  storageBucket: "voteapp-aef90.appspot.com",
  messagingSenderId: "143683190764"
};

window.app = firebase.initializeApp(FIREBASE_CONFIG);
window.auth = app.auth();
window.db = app.database();

var authCheck = function(user) {
  if(user) {
    $("#login-btn").hide();
    $("#logout-btn").show();
    getLoggedInUser();
  } else {
    $("#login-btn").show();
    $("#logout-btn").hide();
  }
};

auth.onAuthStateChanged(authCheck);

$(document).on("ready", function(){
  var votedUsersRef = firebase.database().ref("votedUsers/");
  votedUsersRef.orderByChild("voter").on("child_added", function(data) {
    if(data.val().voter == auth.currentUser.uid){
      var playersRef = firebase.database().ref("votes/");
      playersRef.orderByKey().on("child_added", function(talkData) {
        if(talkData.key == data.val().talk){
          $("#votedFor").text("You voted for: "+ talkData.val().author);
          var para = $("<p></p>");
          var unvoteBtn = $("<a></a>", {"id": "unvote-"+talkData.key, "class": "btn btn-primary btn-danger", "onClick":"unvote(\""+talkData.key+"\")"}).text("Unvote");
          $("#votedFor").append(para, unvoteBtn);
        }
      });
    }
  });

  showVotingTime();
  firebase.database().ref('/admin/').once('value').then(function(snapshot) {
    if(auth.currentUser != null && auth.currentUser.uid == snapshot.val()){
      $("#add-talk").removeClass("hidden");
    }
  });
  firebase.database().ref('/votes/').once('value').then(function(snapshot) {
    var talks = snapshot.val();
    for (var key in talks) {
      var topCard = $("<div></div>", {"class":"card rcorners", "style":"margin:15px;"});
      var blockCard = $("<div></div>", {"class":"card-block", "style":"padding: 19px;"});
      var h4Card = $("<h4></h4>", {"class":"card-title"}).text(talks[key].voteTitle);
      var pTemp = $("<p></p>", {"id":"h4"+key});
      var h5Card = $("<h5></h5>", {"class":"card-subtitle mb-2 text-muted"}).text(talks[key].author);
      var pCard = $("<p></p>", {"class":"card-text"}).text(talks[key].desc);
      var cardBtn = $("<a></a>", {"id": key, "class": "btn btn-primary", "onClick":"vote(\""+key+"\")"}).text("Vote");

      topCard.append(blockCard);
      blockCard.append(h4Card, pTemp, h5Card, pCard, cardBtn);
      $("#vote-container").append(topCard);
      if(window.voting==="closed"){
        disableVotingButton(key);
      }
      isAlreadyVoted(key);
      getCount(key);
    }
  });

});

function getCount(key){
  db.ref("/votes/" + key).once('value').then(function(result){
    $("#h4"+key).text(" - vote: " + result.val().count);
  });
}

function getLoggedInUser(){
  if(auth.currentUser){
    $("#signedin").text(auth.currentUser.email);
  }
}

function isAlreadyVoted(key){
  var votedUsers = db.ref("votedUsers");
  votedUsers.once('value', function(snapshot){
    snapshot.forEach(function(childSnapshot) {
      var childData = childSnapshot.val();
      if(auth.currentUser != null && childData["voter"] == auth.currentUser.uid){
        disableVotingButton(key);
      }
    });
  });
}

function disableVotingButton(key){
  $("#"+key).addClass("disabled");
}

function login(){
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/plus.login');
  auth.signInWithPopup(provider).then(function(result) {
    // This gives you a Google Access Token. You can use it to access the Google API.
    var token = result.credential.accessToken;
    // The signed-in user info.
    var user = result.user;
    console.log(token);
    console.log(user);
    window.location.reload();
  }).catch(function(error) {
    var errorCode = error.code;
    var errorMessage = error.message;
    var email = error.email;
    var credential = error.credential;
    console.log(error);
  });
  window.locatin.reload();
}


function logout() {
  auth.signOut().then(function() {
    console.log('Signed Out');
    window.location.reload();
  }, function(error) {
    console.error('Sign Out Error', error);
  });
}

function showVotingTime(){
  firebase.database().ref('/deadline/').once('value').then(function(snapshot) {
    var deadline = snapshot.val();
    var dateParts = deadline.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
    var day = dateParts[1];
    var month = dateParts[2] - 1;
    var year = dateParts[3];
    var hours = dateParts[4];
    var minutes = dateParts[5];
    var date = new Date(year, month, day, hours, minutes);
    if(date > Date.now()){
      $("#voting-time").text("Voting is open until: " + hours + ":" + minutes + ", " + date.toDateString());
    }else{
      $("#voting-time").text("Voting is closed for this time.");
      window.voting = "closed";
    }
  });
}

function popupAddVote() {
  var user = auth.currentUser;

  if (user) {
    $("#voteModal").modal("show");
  } else {
    BootstrapDialog.show({
      type: BootstrapDialog.TYPE_DANGER,
      title: 'Error',
      message: 'Please try logging in.',
      buttons: [{
        label: 'Login',
        action: login
      }]
    });

  }
}

function result(){
  var voteRef = firebase.database().ref("votes/");

  voteRef.orderByChild("count").limitToLast(1).on("value", function(data) {
    data.forEach(function(data) {
      var output = "Winner is: " + data.val().author + " for " + data.val().voteTitle+ " with " + data.val().count + " votes";
      $("#result-body").text(output);
    });
  });
  $("#resultModal").modal("show");
}

function addVote() {
  var voteObject = $("#frmVoteAdd").serializeObject();
  voteObject["date"] = firebase.database.ServerValue.TIMESTAMP;
  voteObject["user"] = auth.currentUser.uid;
  /* voteObject["count"] = {
  "count": 0,
  "user": {}
} */
voteObject["count"] = 0;
voteObject["voters"]={};
var key = db.ref().child('votes').push().key;

// Write the new post's data simultaneously in the posts list and the user's post list.
var updates = {};
updates['/votes/' + key] = voteObject;
//updates['/user-votes/' + auth.currentUser.uid + '/' + key] = voteObject;

return db.ref().update(updates, function(error) {
  if (error) {
    BootstrapDialog.show({
      type: BootstrapDialog.TYPE_DANGER,
      title: 'Error',
      message: 'Unkown problem',
      buttons: [{
        label: 'Close',
        action: function(dialog){dialog.close();}
      }]
    });
  } else {
    $("#voteModal").modal("hide");
    document.location.reload();
  }
});
}

function vote(key) {
  if(auth.currentUser == null ) {
    BootstrapDialog.show({
      type: BootstrapDialog.TYPE_DANGER,
      title: 'Error',
      message: 'Try logging in',
      buttons: [{
        label: 'Login',
        action: login
      }]
    });
    return false;
  }

  incrementVoteCount(key);
  addVotedUser(key, auth.currentUser.uid);
  getCount(key);
}

function unvote(key){
  if(auth.currentUser == null) {
    BootstrapDialog.show({
      type: BootstrapDialog.TYPE_DANGER,
      title: 'Error',
      message: 'Try logging in',
      buttons: [{
        label: 'Close',
        action: login
      }]
    });
    return false;
  }

  decrementVoteCount(key);
  removeVotedUser(key, auth.currentUser.uid);
  getCount(key);
}

function incrementVoteCount(key){
  var countRef = db.ref("votes").child(key).child('count');
  countRef.transaction(function(currentCount){
    return currentCount + 1;
  });
}

function decrementVoteCount(key){
  var countRef = db.ref("votes").child(key).child('count');
  countRef.transaction(function(currentCount){
    return currentCount - 1;
  });
}

function addVotedUser(key, val) {
  var voteRef = db.ref("votes").child(key).child("voters");
  var votedUsers = db.ref("votedUsers").push();
  votedUsers.set({voter:val, talk:key});

  var voteUpdateRed = voteRef.push();
  voteUpdateRed.set(val, function(error) {
    if (error) {
      BootstrapDialog.show({
        type: BootstrapDialog.TYPE_DANGER,
        title: 'Error',
        message: 'Unkown problem.',
        buttons: [{
          label: 'Close',
          action: function(dialog){dialog.close();}
        }]
      });
    } else {
      document.location.reload();
    }
  });

}

function removeVotedUser(key, val){
  var voteRef = db.ref("votes").child(key).child("voters");

  var votedUsers = db.ref("votedUsers");
  votedUsers.once('value', function(snapshot){
    snapshot.forEach(function(childSnapshot) {
      var childKey = childSnapshot.key;
      var childData = childSnapshot.val();
      if(childData["voter"] == val){
        votedUsers.child(childKey).remove();
      }
    });
  });

  voteRef.once('value', function(snapshot){
    snapshot.forEach(function(childSnapshot) {
      var childKey = childSnapshot.key;
      var childData = childSnapshot.val();
      if(childData == val){
        voteRef.child(childKey).remove();
      }
    });
  });
  document.location.reload();
}
