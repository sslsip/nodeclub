var models = require('../../models');
var TopicModel = models.Topic;
var TopicProxy = require('../../proxy').Topic;
var UserModel = models.User;
var config = require('../../config');
var eventproxy = require('eventproxy');
var _ = require('lodash');
var at = require('../../common/at');
var renderHelpers = require('../../common/render_helpers');

var index = function (req, res, next) {
  var page = parseInt(req.query.page, 10) || 1;
  page = page > 0 ? page : 1;
  var tab = req.query.tab || req.session.tab || 'all';
  var limit = Number(req.query.limit) || config.list_topic_count;
  var mdrender = req.query.mdrender !== void 0 ? (!!req.query.mdrender) : true;

  var query = {};
  if (tab && tab !== 'all') {
    query.tab = tab;
  }
  var options = { skip: (page - 1) * limit, limit: limit, sort: '-top -last_reply_at'};

  var ep = new eventproxy();
  ep.fail(next);

  TopicModel.find(query, '', options, ep.done('topics'));

  ep.all('topics', function (topics) {
    topics.forEach(function (topic) {
      UserModel.findById(topic.author_id, ep.done(function (author) {
        if (mdrender) {
          topic.content = renderHelpers.markdown(at.linkUsers(topic.content));
        }
        topic.author = _.pick(author, ['loginname', 'avatar_url']);
        ep.emit('author');
      }));
    });

    ep.after('author', topics.length, function () {
      topics = topics.map(function (topic) {
        return _.pick(topic, ['id', 'author_id', 'tab', 'content', 'title', 'last_reply_at',
          'good', 'top', 'author']);
      });

      res.send({data: topics});
    });
  });
};

exports.index = index;

var show = function (req, res, next) {
  var topicId = req.params.id;
  var mdrender = req.query.mdrender !== void 0 ? (!!req.query.mdrender) : true;

  var ep = new eventproxy();
  ep.fail(next);

  TopicProxy.getFullTopic(topicId, ep.done(function (msg, topic, author, replies) {
    if (!topic) {
      return res.send({error_msg: 'topic_id `' + topicId + '` is not exists.'});
    }
    topic = _.pick(topic, ['id', 'author_id', 'tab', 'content', 'title', 'last_reply_at',
      'good', 'top', 'author']);

    if (mdrender) {
      topic.content = renderHelpers.markdown(at.linkUsers(topic.content));
    }
    topic.author = _.pick(author, ['loginname', 'avatar_url']);

    topic.replies = replies.map(function (reply) {
      if (mdrender) {
        reply.content = renderHelpers.markdown(at.linkUsers(reply.content));
      }
      reply.author = _.pick(reply.author, ['loginname', 'avatar_url']);
      reply =  _.pick(reply, ['id', 'author', 'content', 'ups', 'create_at']);
      return reply;
    });
    res.send({data: topic});
  }));
};

exports.show = show;
