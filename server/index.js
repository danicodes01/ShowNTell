/* eslint-disable no-continue */
/* eslint-disable no-param-reassign */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
const path = require('path');
const express = require('express');
const passport = require('passport');
const axios = require('axios');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
require('dotenv').config();
require('./db/index');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const Notifs = require('twilio')(accountSid, authToken);
const { GoogleStrategy } = require('./oauth/passport');
const { Users, Posts, Shows, Replys } = require('./db/schema.js');
// const { session } = require('passport');

const app = express();

const client = path.resolve(__dirname, '..', 'client', 'dist');

let userInfo = null;

app.use(express.static(client));
app.use(express.json());
app.use(cookieParser());
app.use(cors());

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

app.use(
  session({
    secret: process.env.GOOGLE_CLIENT_SECRET,
    saveUninitialized: false,
    resave: true,
  }),
);
app.use(passport.initialize());
app.use(passport.session());

app.get(
  '/auth/google',
  passport.authenticate(
    'google',
    { scope: ['https://www.googleapis.com/auth/plus.login'] },
    (req, res) => {
      // res.redirect('/');
    },
  ),
);

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/logout' }),
  (req, res) => {
    const newUser = new Users({
      id: Number(req.user.id),
      name: req.user.displayName,
    });
    res.cookie('ShowNTellId', req.user.id);

    Users.findOne({ id: Number(req.user.id) }).then((data) => {
      if (data) {
        res.redirect('/');
        userInfo = data;
      } else {
        newUser.save().then(() => {
          userInfo = newUser;
          res.redirect('/');
        });
      }
    });
  },
);

app.get('/user', (req, res) => {
  // res.status(200).json(userInfo);
  // console.log(req.cookies.ShowNTellId);
  Users.findOne({ id: req.cookies.ShowNTellId }).then((data) => {
    userInfo = data;
    res.json(userInfo);
  });
  // if (userInfo !== null) {
  //   Users.findOne({ id: userInfo.id }).then((data) => {
  //     userInfo = data;
  //     res.json(userInfo);
  //   });
  // } else {
  //   res.json(userInfo);
  // }
});

app.get('/users', (req, res) => {
  Users.find()
    .then((data) => res.status(200).json(data))
    .catch();
});

app.get('/posts', (req, res) => {
  // Posts.remove().then(
  Posts.find()
    .then((posts) => res.send(posts))
    .catch();
  // );
});

app.get('/shows', (req, res) => {
  Shows.find()
    .then((data) => res.status(200).json(data))
    .catch();
});

app.get('/findUser', (req, res) => {
  // Users.remove().then(
  Users.find()
    .then((data) => res.json(data))
    .catch();
  // );
});

app.get('/user/posts/:name', (req, res) => {
  console.log('PARAMS', req.params.name);
  const user = req.params.name;
  Posts.find({ name: user })
    .then((posts) => res.send(posts))
    .catch();
});

app.put('/startMessage/:user/:name', (req, res) => {
  Users.updateOne(
    { id: userInfo.id },
    {
      messages: [
        ...userInfo.messages,
        { id: req.params.user, name: req.params.name, text: [] },
      ],
    },
  )
    .then((data) => res.json(data))
    .catch();
});

app.put('/sendMessage/:id/:text', (req, res) => {
  const content = userInfo.messages;
  for (let i = 0; i < content.length; i += 1) {
    if (content[i].id === req.params.id) {
      content[i].text.push({ name: userInfo.name, message: req.params.text });
      break;
    }
  }
  Users.updateOne({ id: userInfo.id }, { messages: content })
    .then(() => Users.findOne({ id: req.params.id }))
    .then((data) => {
      const replace = data.messages || [];
      let test = false;
      for (let i = 0; i < replace.length; i += 1) {
        if (replace[i].id === String(userInfo.id)) {
          replace[i].text.push({
            name: userInfo.name,
            message: req.params.text,
          });
          test = true;
          break;
        }
      }
      if (test) {
        Users.updateOne(
          { id: Number(req.params.id) },
          { messages: replace,
            notifs: [...data.notifs, `${userInfo.name} messaged you`],
          },
        ).then((result) => res.json(result));
      } else {
        // console.log(content, 'here');
        Users.updateOne(
          { id: Number(req.params.id) },
          {
            messages: [
              ...replace,
              {
                id: String(userInfo.id),
                name: userInfo.name,
                text: [{ name: userInfo.name, message: req.params.text }],
              },
            ],
            notifs: [...data.notifs, `${userInfo.name} messaged you`],
          },
        ).then((result) => res.json(result));
      }
    });
});

app.post('/addComment', (req, res) => {
  const comment = req.body.comment;
  // console.log('----', comment);
  const postId = req.body.postId;
  Posts.updateOne({ _id: postId }, { $push: { comments: comment } }).then(
    () => {
      Posts.find({ _id: postId }).then((post) => {
        // console.log(post);
        res.send(post[0].comments);
      });
    },
  );
});

app.post('/addResponse', (req, res) => {
  const update = (comments) => {
    comments.forEach((comment) => {});
  };
  Posts.updateOne(
    { 'comments.currentComment': req.body.comment.parentComment },
    {
      $push: {
        'comments.$.childComments': req.body.comment.currentComment,
      },
    },
  )
    .then(() => {
      Posts.find({ _id: req.body.comment.postId }).then((post) => {
        res.send(post[0].comments);
      });
    })
    .catch((err) => {
      console.log(err);
    });
});

app.get('/search/:query', (req, res) => {
  const url = `http://api.tvmaze.com/search/shows?q=${req.params.query}`;
  return axios(url)
    .then(({ data }) => data)
    .then((data) => res.status(200).send(data))
    .catch(() => console.log('error'));
});

app.get('/show/:id', (req, res) => {
  Shows.find({ id: req.params.id })
    .then((record) => {
      if (record.length > 0) {
        return record[0];
      }
      return axios(`http://api.tvmaze.com/shows/${req.params.id}`)
        .then(({ data }) => Shows.create({
          id: data.id,
          name: data.name,
          posts: [],
          subscriberCount: 0,
        })).then((result) => result)
        .catch();
    })
    .then((result) => res.status(200).send(result))
    .catch(() => res.status(500).send());
});

app.put('/subscribe/:id', (req, res) => {
  const { id } = req.params;
  Users.findById(userInfo._id)
    .then((user) => {
      if (!user.subscriptions.includes(id)) {
        userInfo.subscriptions = [...user.subscriptions, id];
        Users.updateOne(
          { _id: user._id },
          { subscriptions: [...user.subscriptions, id] },
        ).then(() => {
          Shows.findOne({ id })
            .then((record) => {
              Shows.updateOne(
                { id: req.params.id },
                { subscriberCount: record.subscriberCount + 1 },
              ).catch();
            })
            .catch();
        }).catch();
      } else {
        console.log('already subscribed');
      }
    })
    .then(() => res.status(200).send())
    .catch(() => res.status(500).send());
});

app.get('/delete', (req, res) => {
  Users.deleteMany()
    .then(() => Posts.deleteMany())
    .then(() => Shows.deleteMany())
    .then(() => Replys.deleteMany())
    .then(() => res.status(200).json('done'))
    .catch();
});

app.get('/logout', (req, res) => {
  userInfo = null;
  res.clearCookie('ShowNTellId');
  res.status(200).json(userInfo);
});

app.post('/posts', (req, res) => {
  const { title, content, poster, show, name } = req.body;

  return Posts.create({
    title,
    content,
    user: poster,
    name,
    show,
    comments: {},
    createdAt: new Date(),
    liked: false,
    likedCount: 0,
  })
    .then((post) => {
      Users.findById(poster)
        .then((user) => {
          userInfo.posts = [...user.posts, post._id];
          Users.updateOne(
            { _id: poster },
            { posts: [...user.posts, post._id] },
          ).catch();
        }).then(() => {
          Shows.findOne({ id: show })
            .then((record) => {
              Shows.updateOne(
                { id: show },
                { posts: [...record.posts, post._id] },
              ).catch();
            }).catch();
        })
        .catch();
    })
    .then(() => res.status(201).send())
    .catch(() => res.status(500).send());
});

app.get('/post/:id', (req, res) => {
  Posts.findById(req.params.id)
    .then((post) => res.status(200).send(post))
    .catch(() => res.status(500).send());
});

app.post('/number', (req, res) => {
  const { number } = req.body;
  if (!number) {
    Users.updateOne({ id: userInfo.id }, { phone: number })
      .then((data) => res.json(data));
  } else {
    Users.updateOne({ id: userInfo.id }, { phone: number, notifs: [`you will now receive notifications @ ${number}   `] })
      .then((data) => res.json(data));
  }
});

app.get('/notifs/:text/:id', (req, res) => {
  res.json(req.params);
  if (req.params.id === 'null') {
    Notifs.messages
      .create({
        body: req.params.text,
        from: '+12678677568',
        to: userInfo.phone,
      })
      .then((message) => res.json(message.sid))
      .catch((err) => console.log(err));
  } else {
    Users.findOne({ id: req.params.id })
      .then((data) => {
        Notifs.messages
          .create({
            body: req.params.text,
            from: '+12678677568',
            to: data.phone,
          })
          .then((message) => res.json(message.sid))
          .catch((err) => console.log(err));
      });
  }
});

app.delete('/notifs/:index', (req, res) => {
  const replacementNotif = [];
  for (let i = 0; i < userInfo.notifs.length; i += 1) {
    if (i !== Number(req.params.index)) {
      replacementNotif.push(userInfo.notifs[i]);
    }
  }
  Users.update({ id: userInfo.id }, { notifs: replacementNotif })
    .then((data) => res.json(data));
});

app.get('/postShow/:id', (req, res) => {
  Shows.findOne({ id: req.params.id })
    .then((data) => res.json(data));
});

app.get('/postUser/:id', (req, res) => {
  Users.findOne({ _id: req.params.id })
    .then((data) => res.json(data));
});

app.get('/liked/:id', (req, res) => {
  Posts.findOne({ _id: req.params.id })
    .then((data) => {
      const newLike = [];
      let test = true;
      for (let i = 0; i < data.likes.length; i += 1) {
        if (data.likes[i] === userInfo.id) {
          test = false;
          continue;
        } else {
          newLike.push(data.likes[i]);
        }
      }
      if (test) {
        Posts.updateOne({ _id: req.params.id }, { likes: [...data.likes, userInfo.id] })
          .then(() => res.json());
      } else {
        Posts.updateOne({ _id: req.params.id }, { likes: newLike })
          .then(() => res.json());
      }
    });
});

app.get('/replys/:id/:content', (req, res) => {
  Replys.create({
    user: userInfo._id,
    content: req.params.content,
    comment: [],
    likes: [],
  }).then(({ _id }) => {
    Posts.findOne({ _id: req.params.id })
      .then((data) => {
        Posts.updateOne({ _id: req.params.id }, { comment: [...data.comment, _id] })
          .then(() => Posts.findOne({ _id: req.params.id }))
          .then((result) => res.json(result));
      });
  });
});

app.get('/feeds/:id', (req, res) => {
  Replys.findOne({ _id: req.params.id })
    .then((data) => res.json(data));
});

app.get('/findReplays', (req, res) => {
  Replys.find()
    .then((data) => res.json(data));
});

app.post('/replys/:id/:content', (req, res) => {
  Replys.create({
    user: userInfo._id,
    content: req.params.content,
    comment: [],
    likes: [],
  }).then(({ _id }) => {
    Replys.findOne({ _id: req.params.id })
      .then((data) => {
        Replys.updateOne({ _id: req.params.id }, { comment: [...data.comment, _id] })
          .then(() => Replys.findOne({ _id: req.params.id }))
          .then((result) => res.json(result));
      });
  });
});

app.get('/likedPost/:id', (req, res) => {
  Replys.findOne({ _id: req.params.id })
    .then((data) => {
      const newLike = [];
      let test = true;
      for (let i = 0; i < data.likes.length; i += 1) {
        if (data.likes[i] === userInfo.id) {
          test = false;
          continue;
        } else {
          newLike.push(data.likes[i]);
        }
      }
      if (test) {
        Replys.updateOne({ _id: req.params.id }, { likes: [...data.likes, userInfo.id] })
          .then(() => res.json());
      } else {
        Replys.updateOne({ _id: req.params.id }, { likes: newLike })
          .then(() => res.json());
      }
    });
});

app.listen(3000, () => {
  console.log('http://localhost:3000');
});
