/**
 * blog.js — Blog engine with tag filtering for siponline.github.io
 *
 * Posts are defined in posts/index.json, content in posts/*.md.
 * Call Blog.init(config) to bootstrap on any page.
 */
(function (global) {
  'use strict';

  var Blog = {};
  var POSTS_URL = 'posts/index.json';
  var CACHE = null;
  var CONFIG = {};
  var ACTIVE_TAGS = [];

  /* ---------- utilities ---------- */

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(d) {
    var opts = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', opts);
  }

  /* ---------- data ---------- */

  function loadPosts() {
    if (CACHE) return Promise.resolve(CACHE);
    return fetch(POSTS_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load posts manifest');
        return r.json();
      })
      .then(function (posts) {
        posts.sort(function (a, b) { return b.date.localeCompare(a.date); });
        CACHE = posts;
        return posts;
      });
  }

  function loadMarkdown(file) {
    return fetch('posts/' + file).then(function (r) {
      if (!r.ok) throw new Error('Failed to load: ' + file);
      return r.text();
    });
  }

  /* ---------- tag helpers ---------- */

  function getAllTags(posts) {
    var map = {};
    posts.forEach(function (p) {
      if (p.tags && p.tags.length) {
        p.tags.forEach(function (t) {
          map[t] = (map[t] || 0) + 1;
        });
      }
    });
    /* sort by count desc, then alphabetically */
    return Object.keys(map).sort(function (a, b) {
      return map[b] - map[a] || a.localeCompare(b);
    }).map(function (tag) {
      return { name: tag, count: map[tag] };
    });
  }

  function filterPosts(posts, tags) {
    if (!tags || !tags.length) return posts;
    return posts.filter(function (p) {
      if (!p.tags || !p.tags.length) return false;
      return tags.every(function (t) { return p.tags.indexOf(t) !== -1; });
    });
  }

  /* ---------- render: tag cloud ---------- */

  function renderTagCloud(selector, posts) {
    var container = $(selector);
    if (!container) return;

    var tags = getAllTags(posts);
    if (!tags.length) return;

    var html = '<span class="tag-chip tag-chip--all active" data-tag="*">All<span class="tag-count">' + posts.length + '</span></span>';
    tags.forEach(function (t) {
      html += '<span class="tag-chip" data-tag="' + esc(t.name) + '">' + esc(t.name) + '<span class="tag-count">' + t.count + '</span></span>';
    });
    container.innerHTML = html;

    /* click handler */
    $$('.tag-chip', container).forEach(function (chip) {
      chip.addEventListener('click', function () {
        var tag = chip.dataset.tag;

        if (tag === '*') {
          /* click All: clear all filters */
          ACTIVE_TAGS = [];
        } else {
          /* toggle */
          var idx = ACTIVE_TAGS.indexOf(tag);
          if (idx >= 0) {
            ACTIVE_TAGS.splice(idx, 1);
          } else {
            ACTIVE_TAGS.push(tag);
          }
        }

        /* update visual state */
        $$('.tag-chip', container).forEach(function (c) {
          if (c.dataset.tag === '*') {
            c.classList.toggle('active', ACTIVE_TAGS.length === 0);
          } else {
            c.classList.toggle('active', ACTIVE_TAGS.indexOf(c.dataset.tag) !== -1);
          }
        });

        /* re-render posts */
        refreshPosts();
      });
    });
  }

  /* ---------- render: post cards ---------- */

  function renderPostCard(post) {
    var html = '<article class="post-card" data-post-id="' + esc(post.id) + '">';

    if (post.tags && post.tags.length) {
      html += '<div class="post-tags">';
      post.tags.forEach(function (t) {
        html += '<span class="post-tag">' + esc(t) + '</span>';
      });
      html += '</div>';
    }

    html += '<h3 class="post-title">' + esc(post.title) + '</h3>';
    html += '<time class="post-date">' + formatDate(post.date) + '</time>';

    if (post.summary) {
      html += '<p class="post-excerpt">' + esc(post.summary) + '</p>';
    }

    html += '<a class="post-readmore" href="javascript:void(0)" data-post-id="' + esc(post.id) + '">Read more &rarr;</a>';
    html += '</article>';
    return html;
  }

  function renderPosts(selector, posts, activeTags) {
    var container = $(selector);
    if (!container) return;

    var filtered = filterPosts(posts, activeTags);

    if (!filtered.length) {
      container.innerHTML = '<p class="post-empty">No posts match the selected tags.</p>';
      return;
    }

    var html = '<div class="post-card-list">';
    filtered.forEach(function (p) { html += renderPostCard(p); });
    html += '</div>';
    container.innerHTML = html;

    /* attach click handlers */
    $$('.post-readmore', container).forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var postId = link.dataset.postId;
        var post = posts.filter(function (p) { return p.id === postId; })[0];
        if (post) openPost(post);
      });
    });
  }

  function refreshPosts() {
    renderPosts(CONFIG.postList, CACHE, ACTIVE_TAGS);
  }

  /* ---------- post overlay ---------- */

  function openPost(post) {
    var overlay = $(CONFIG.overlay.el);
    if (!overlay) return;

    $(CONFIG.overlay.title).textContent = post.title;
    $(CONFIG.overlay.date).textContent = formatDate(post.date);
    $(CONFIG.overlay.body).innerHTML = 'Loading&hellip;';

    overlay.classList.add('open');
    document.body.classList.add('no-scroll');

    loadMarkdown(post.file).then(function (mdText) {
      var body = $(CONFIG.overlay.body);
      body.innerHTML = (typeof marked !== 'undefined' && marked.parse)
        ? marked.parse(mdText)
        : '<pre>' + esc(mdText) + '</pre>';
    }).catch(function () {
      $(CONFIG.overlay.body).innerHTML = '<p>Unable to load post content.</p>';
    });
  }

  /* ---------- init ---------- */

  Blog.init = function (config) {
    CONFIG = config;

    loadPosts().then(function (posts) {
      /* tag cloud */
      if (CONFIG.tagCloud) {
        renderTagCloud(CONFIG.tagCloud, posts);
      }
      /* initial render */
      renderPosts(CONFIG.postList, posts, ACTIVE_TAGS);
    }).catch(function (err) {
      console.error('Blog init failed:', err);
      var list = $(CONFIG.postList);
      if (list) list.innerHTML = '<p class="post-empty">Unable to load blog posts.</p>';
    });
  };

  /* ---------- export ---------- */
  global.Blog = Blog;

}(window));
