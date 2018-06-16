// Firebase Functions SDK
// HTTPリクエストをトリガする
const functions = require('firebase-functions');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

// Firebase Admin SDK
// Realtime Datanaseの処理と認証をする
const admin = require('firebase-admin');
// adminインスタンスを初期化
admin.initializeApp(functions.config().firebase);

// Expressモジュールをインポート、初期化
const express = require('express');
const app = express();

// CORSモジュールをインポート、初期化
const cors = require('cors')({origin: true});
app.use(cors);

// ---------- ユーザ情報を取得 ----------
const anonymousUser = {
  id: 'anon',
  name: 'Anonymous',
  avatar: ''
};

// ユーザの検証
const checkUser = (req, res, next) => {
  req.user = anonymousUser;
  if (req.query.auth_token != undefined) {
    let idToken = req.query.auth_token;
    // admin.auth().verifyIdToken(idToken) -> ユーザ検証
    admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
      let authUser = {
        id: decodedIdToken.user_id,
        name: decodedIdToken.name,
        avatar: decodedIdToken.picture
      };
      req.user = authUser;
      next();
    }).catch(error => {
      next();
    });
  } else {
    next();
  };
};

// ロード
app.use(checkUser);


// ---------- チャンネルを作成するAPI ----------
// チャンネルの作成
// Realtime Databaseのパスchannels/:cnameにデータを挿入
function createChannel(cname) {
  // .ref(node) -> 特定のノードを参照
  let channelsRef = admin.database().ref('channels');
  let date1 = new Date();
  let date2 = new Date();
  date2.setSeconds(date2.getSeconds() + 1);
  const defaultData = `{
    "messages" : {
      "1" : {
        "body" : "Welcome to #${cname} channel!",
        "date" : "${date1.toJSON()}",
        "user" : {
          "avatar" : "",
          "id" : "robot",
          "name" : "Robot"
        }
      },
      "2" : {
        "body" : "はじめてのメッセージを投稿してみましょう。",
        "date" : "${date2.toJSON()}",
        "user" : {
          "avatar" : "",
          "id" : "robot",
          "name" : "Robot"
        }
      }
    }
  }`;
  // .child(node) -> 参照先の子ノードの参照
  channelsRef.child(cname).set(JSON.parse(defaultData));
}

// /channelsへのPOST後の処理
app.post('/channels', (req, res) => {
  let cname = req.body.cname;
  // チャンネルの作成
  createChannel(cname);
  res.header('Content-Type', 'application/json; charset=urf-8');
  res.status(201).json({result: 'ok'});
});

// ---------- チャンネル一覧を取得するAPI ----------
// /channelsへのGET後の処理
// Realtime Databaseからチャンネル名を取得、一覧をJSONで返す
app.get('/channels', (req, res) => {
  let channelsRef = admin.database().ref('channels');
  // valueイベントを使ってRealtime Databaseからデータをよみ出し
  // onceで1回だけ実行
  channelsRef.once('value', function(snapshot) {
    let items = new Array();
    snapshot.forEach(function(childSnapshot) {
      let cname = childSnapshot.key;
      items.push(cname);
    });
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.send({channels: items});
  });
});

// ---------- 指定チャンネルへメッセージを追加するAPI ----------
app.post('/channels/:cname/messages', (req, res) => {
  // postの:cnameを取得
  let cname = req.params.cname;
  let message = {
    date: new Date().toJSON(),
    body: req.body.body,
    user: req.user
  };
  let messagesRef = admin.database().ref(`channels/${cname}/messages`);
  messagesRef.push(message);
  res.header('Content-Type', 'application/json; charset=utf-8');
  res.header(201).send({result: 'ok'});
});

// ---------- チェンネル内メッセージ一覧を取得するAPI ----------
app.get('/channels/:cname/messages', (req, res) => {
  let cname = req.params.cname;
  // orderByChild -> 子キーdateで並べ替え
  // limitToLast -> 最後から20件
  let messagesRef = admin.database().ref(`channels/${cname}/messages`).orderByChild('date').limitToLast(20);
  messagesRef.once('value', function(snapshot) {
    let items = new Array();
    snapshot.forEach(function(childSnapshot) {
      let message = childSnapshot.val();
      message.id = childSnapshot.key;
      items.push(message);
    });
    items.reverse();
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.send({messages: items});
  });
});

// ---------- 初期状態に戻すAPI ----------
app.post('/reset', (req, res) => {
  createChannel('general');
  createChannel('random');
  res.header('Content-Type', 'application/json; charset=utf-8');
  res.status(201).send({result: 'ok'});
});

// appを外部から呼び出せるようにする
// functions.http.onRequest -> HTTPリクエストのイベント処理ができる
exports.v1 = functions.https.onRequest(app);