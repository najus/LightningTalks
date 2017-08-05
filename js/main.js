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
  } else {
    $("#login-btn").show();
    $("#logout-btn").hide();
  }
};

auth.onAuthStateChanged(authCheck);

$(document).on("ready", function(){
  firebase.database().ref('/votes/').once('value').then(function(snapshot) {
    var alreadyVoted = false;
    var votedUsers = db.ref("votedUsers");
    votedUsers.once('value', function(snapshot){
      snapshot.forEach(function(childSnapshot) {
        var childData = childSnapshot.val();
        if(auth.currentUser !=null && childData == auth.currentUser.uid){
          alreadyVoted = true;
          return;
        }
      });
    });

    var talks = snapshot.val();
    for (var key in talks) {
      var disabledClassValue= "";
      var topCard = $("<div></div>", {"class":"card"});
      var blockCard = $("<div></div>", {"class":"card-block"});
      var h4Card = $("<h4></h4>", {"class":"card-title"}).text(talks[key].voteTitle);
      var pTemp = $("<p></p>", {"id":"h4"+key});
      var h5Card = $("<h5></h5>", {"class":"card-subtitle mb-2 text-muted"}).text(talks[key].author);
      var pCard = $("<p></p>", {"class":"card-text"}).text(talks[key].desc);
      if(alreadyVoted){
        disabledClassValue = "disabled";
      }
      var cardBtn = $("<a></a>", {"id": key, "class":"btn btn-primary " + disabledClassValue, "onClick":"vote(\""+key+"\")"}).text("Vote");

      topCard.append(blockCard);
      blockCard.append(h4Card, pTemp, h5Card, pCard, cardBtn);

      $("#vote-container").append(topCard);
      getCount(key);
    }
  });
});

function getCount(key){
  db.ref("/votes/" + key).once('value').then(function(result){

    $("#h4"+key).text(" - vote: " + result.val().count);
  });
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
  }).catch(function(error) {
    var errorCode = error.code;
    var errorMessage = error.message;
    var email = error.email;
    var credential = error.credential;
    console.log(error);
  });
}


function logout() {
  auth.signOut().then(function() {
    console.log('Signed Out');
  }, function(error) {
    console.error('Sign Out Error', error);
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

function addPage(keys) {
  var voteContainer = $("#vote-container");

  $.each(keys, function(index) {
    var voteHtml = renderVoteItem(keys[index], votePaginator.collection[keys[index]]);
    voteContainer.append(voteHtml);
  });
}

function renderVoteItem(key, value) {
  var source = $("#vote-item").html();
  var template = Handlebars.compile(source);

  value["key"] = key;
  if(auth.currentUser && auth.currentUser.uid == value.user) {
    value["mine"] = true;
  }
  var voteHtml = $(template(value));
  if(value.count.user && auth.currentUser) {
    var index = value.count.user[auth.currentUser.uid];
    if(index)
    voteHtml.find("a").eq(index - 1).addClass("btn-info");

  }


  return voteHtml;
}

function vote(key) {
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

  incrementVoteCount(key);
  addVotedUser(key, "testUser");
  getCount(key);

  decrementVoteCount(key);
  // removeVotedUser(key, "testUser");
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
  votedUsers.set(val);

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
      if(childData == val){
        voteRef.child(childKey).remove();
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

}

function deleteVote(btn) {
  var key = $(btn).data("key");
  var updates = {};
  updates['/votes/' + key] = null;
  updates['/user-votes/' + auth.currentUser.uid + '/' + key] = null;

  db.ref().update(updates, function(error) {
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

function nextPage() {
  votePaginator.goToPage(votePaginator.pageNumber + 1);
}
