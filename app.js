(function(){
  'use strict';

  var CONFIG = Object.assign({
    googleClientId:'',
    tiktokClientKey:'',
    backendBaseUrl:'',
    discordClientId:'',
    adsenseClient:'',
    adsenseSlot:'',
    demoMode:true
  }, window.SOCIALTOTAL_CONFIG || {});

  var STORAGE_KEY = 'socialtotal_demo_v1';
  var platformOrder = ['youtube','tiktok','instagram','facebook'];
  var platforms = {
    youtube:{
      name:'YouTube', short:'YT',
      permissions:[
        ['See your YouTube channel','Used to show which channel is connected.'],
        ['Upload videos you choose','SocialTotal only uploads after you press Publish.']
      ]
    },
    tiktok:{
      name:'TikTok', short:'TT',
      permissions:[
        ['Read creator information','Used to confirm the connected creator and posting capabilities.'],
        ['Publish content you choose','Videos or supported photos are sent only after explicit confirmation.']
      ]
    },
    instagram:{
      name:'Instagram', short:'IG',
      permissions:[
        ['Use your professional account','Instagram API publishing is for supported professional accounts.'],
        ['Publish media you choose','SocialTotal sends only posts you explicitly publish.']
      ]
    },
    facebook:{
      name:'Facebook', short:'FB',
      permissions:[
        ['Use your selected Page','SocialTotal targets the Page you connect.'],
        ['Publish media you choose','Nothing is posted without your Publish action.']
      ]
    }
  };

  var state = {
    profile:null,
    plan:'free',
    accounts:{
      youtube:{connected:false,name:''},
      tiktok:{connected:false,name:''},
      instagram:{connected:false,name:''},
      facebook:{connected:false,name:''}
    },
    history:[],
    media:null,
    selected:{},
    pendingPlatform:null,
    youtubeAccessToken:null,
    youtubeTokenClient:null,
    demoMode:CONFIG.demoMode !== false
  };

  function $(selector, context){ return (context || document).querySelector(selector); }
  function $$(selector, context){ return Array.prototype.slice.call((context || document).querySelectorAll(selector)); }

  function safeParse(value, fallback){
    try { return JSON.parse(value); } catch(error){ return fallback; }
  }

  function loadState(){
    var saved = safeParse(localStorage.getItem(STORAGE_KEY), null);
    if(!saved) return;
    if(saved.profile) state.profile = saved.profile;
    if(['free','spread','total'].indexOf(saved.plan) !== -1) state.plan = saved.plan;
    if(saved.accounts){
      platformOrder.forEach(function(id){
        if(saved.accounts[id]){
          state.accounts[id].connected = !!saved.accounts[id].connected;
          state.accounts[id].name = saved.accounts[id].name || '';
        }
      });
    }
    if(Array.isArray(saved.history)) state.history = saved.history.slice(0,100);
    if(typeof saved.demoMode === 'boolean') state.demoMode = saved.demoMode;
  }

  function persist(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      profile:state.profile,
      plan:state.plan,
      accounts:state.accounts,
      history:state.history.slice(0,100),
      demoMode:state.demoMode
    }));
  }

  function escapeHTML(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function sleep(ms){
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function formatBytes(bytes){
    if(!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    var units = ['B','KB','MB','GB'];
    var index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    var value = bytes / Math.pow(1024,index);
    return (value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)) + ' ' + units[index];
  }

  function formatDuration(seconds){
    if(!Number.isFinite(seconds) || seconds <= 0) return '—';
    var rounded = Math.round(seconds);
    var minutes = Math.floor(rounded / 60);
    var secs = rounded % 60;
    if(minutes >= 60){
      var hours = Math.floor(minutes / 60);
      minutes = minutes % 60;
      return hours + 'h ' + minutes + 'm';
    }
    return minutes ? minutes + 'm ' + String(secs).padStart(2,'0') + 's' : secs + 's';
  }

  function ratioName(width,height){
    if(!width || !height) return '—';
    var ratio = width / height;
    var known = [
      [9/16,'9:16'],[1,'1:1'],[4/5,'4:5'],[3/4,'3:4'],[4/3,'4:3'],[16/9,'16:9']
    ];
    for(var i=0;i<known.length;i++){
      if(Math.abs(ratio-known[i][0]) < .035) return known[i][1];
    }
    return ratio.toFixed(2) + ':1';
  }

  function planAllows(platform){
    if(platform === 'youtube' || platform === 'tiktok') return true;
    return state.plan === 'spread' || state.plan === 'total';
  }

  function planLabel(){
    return state.plan === 'total' ? 'Total' : state.plan === 'spread' ? 'Spread' : 'Free';
  }

  function toast(title,message,type){
    var region = $('#toastRegion');
    if(!region) return;
    var node = document.createElement('div');
    node.className = 'toast';
    var glyph = type === 'error' ? '!' : type === 'success' ? '✓' : '•';
    node.innerHTML =
      '<span class="toast-icon">' + glyph + '</span>' +
      '<span class="toast-copy"><b>' + escapeHTML(title) + '</b><span>' + escapeHTML(message) + '</span></span>' +
      '<button class="toast-close" type="button" aria-label="Dismiss">×</button>';
    region.appendChild(node);
    requestAnimationFrame(function(){ node.classList.add('show'); });
    var close = function(){
      node.classList.remove('show');
      setTimeout(function(){ if(node.parentNode) node.parentNode.removeChild(node); },220);
    };
    $('.toast-close',node).addEventListener('click',close);
    setTimeout(close,4300);
  }

  function showView(name){
    var auth = $('#authView');
    var onboarding = $('#onboardingView');
    var app = $('#appView');
    [auth,onboarding,app].forEach(function(el){
      el.classList.add('hidden');
      el.setAttribute('aria-hidden','true');
    });
    var target = name === 'auth' ? auth : name === 'onboarding' ? onboarding : app;
    target.classList.remove('hidden');
    target.setAttribute('aria-hidden','false');
  }

  function finishLogin(profile){
    state.profile = {
      name:profile.name || 'SocialTotal creator',
      email:profile.email || '',
      picture:profile.picture || ''
    };
    persist();
    updateProfileUI();
    showView('onboarding');
    renderAll();
  }

  function enterApp(){
    showView('app');
    routeTo('home');
    renderAll();
  }

  function updateProfileUI(){
    var profile = state.profile || {name:'Demo creator',email:'demo@socialtotal.app',picture:''};
    $('#profileName').textContent = profile.name;
    $('#profileEmail').textContent = profile.email || 'SocialTotal account';
    $('#profileAvatar').textContent = (profile.name || 'S').trim().charAt(0).toUpperCase();
    $('#homeGreeting').textContent = 'Good to see you, ' + (profile.name || 'creator').split(' ')[0] + '.';
  }

  function initGoogleSignIn(attempt){
    attempt = attempt || 0;
    if(!CONFIG.googleClientId) return;
    if(!window.google || !google.accounts || !google.accounts.id){
      if(attempt < 30) setTimeout(function(){ initGoogleSignIn(attempt + 1); },200);
      return;
    }
    try{
      google.accounts.id.initialize({
        client_id:CONFIG.googleClientId,
        callback:function(response){
          var payload = decodeJwtPayload(response.credential);
          if(!payload){
            toast('Google sign-in failed','The returned identity token could not be read.','error');
            return;
          }
          finishLogin({
            name:payload.name || payload.given_name || 'Google user',
            email:payload.email || '',
            picture:payload.picture || ''
          });
        }
      });
      var host = $('#googleButtonHost');
      host.innerHTML = '';
      google.accounts.id.renderButton(host,{
        type:'standard',
        theme:'filled_black',
        size:'large',
        text:'continue_with',
        shape:'rectangular',
        width:Math.min(390,Math.max(260,host.clientWidth || 390))
      });
      $('#googleFallbackButton').classList.add('hidden');
    }catch(error){
      console.warn('Google sign-in setup failed',error);
    }
  }

  function decodeJwtPayload(token){
    try{
      var part = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      var json = decodeURIComponent(atob(part).split('').map(function(char){
        return '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(json);
    }catch(error){
      return null;
    }
  }

  function demoLogin(source,email){
    finishLogin({
      name:source === 'Discord' ? 'Discord creator' : email ? email.split('@')[0] : 'Demo creator',
      email:email || (source.toLowerCase() + '@demo.socialtotal.app')
    });
    toast('Demo sign-in','Add production auth credentials later to replace this local demo session.','success');
  }

  function routeTo(route){
    if(!state.profile) return;
    $$('.route').forEach(function(page){
      page.classList.toggle('active',page.getAttribute('data-page') === route);
    });
    $$('[data-route]').forEach(function(button){
      button.classList.toggle('active',button.getAttribute('data-route') === route);
    });
    if(route === 'billing') renderBilling();
    if(route === 'accounts') renderAccounts();
    if(route === 'library') renderLibrary();
    if(route === 'analytics') renderAnalytics();
    window.scrollTo({top:0,behavior:'auto'});
  }

  function connectedCount(){
    return platformOrder.filter(function(id){ return state.accounts[id].connected; }).length;
  }

  function renderAll(){
    updateProfileUI();
    $('#planBadge').textContent = planLabel();
    $('#connectedSummary').textContent = connectedCount() + ' connected';
    $('#onboardingStatus').textContent = connectedCount() + (connectedCount() === 1 ? ' account connected' : ' accounts connected');
    $('#demoModeToggle').checked = !!state.demoMode;
    renderOnboarding();
    renderHome();
    renderAccounts();
    renderDestinations();
    renderLibrary();
    renderAnalytics();
    renderBilling();
    updateAds();
  }

  function renderOnboarding(){
    $$('[data-connect]','#onboardingPlatforms').forEach(function(card){
      var id = card.getAttribute('data-connect');
      var connected = state.accounts[id].connected;
      card.classList.toggle('connected',connected);
      var action = $('.connect-action',card);
      if(action) action.textContent = connected ? 'Connected' : 'Connect';
    });
  }

  function platformLogo(id){
    return '<span class="platform-logo ' + id + '">' + platforms[id].short + '</span>';
  }

  function renderHome(){
    var host = $('#homeAccountList');
    if(!host) return;
    host.innerHTML = platformOrder.map(function(id){
      var account = state.accounts[id];
      var subtitle = account.connected ? (account.name || 'Connected account') : (planAllows(id) ? 'Not connected' : 'Spread plan');
      return '<div class="home-account-row">' +
        platformLogo(id) +
        '<span class="account-copy"><b>' + platforms[id].name + '</b><span>' + escapeHTML(subtitle) + '</span></span>' +
        '<span class="' + (account.connected ? 'account-status' : '') + '">' + (account.connected ? 'Connected' : '—') + '</span>' +
      '</div>';
    }).join('');

    var recent = $('#recentActivity');
    if(state.history.length){
      var item = state.history[0];
      recent.className = 'recent-card';
      recent.innerHTML =
        '<div class="library-item">' +
          '<span class="library-thumb">' + (item.kind === 'image' ? 'IMG' : 'VID') + '</span>' +
          '<span class="library-copy"><b>' + escapeHTML(item.title || item.fileName || 'Untitled post') + '</b><span>' + escapeHTML(item.when) + '</span></span>' +
          '<span class="library-platforms">' + item.platforms.map(function(id){ return '<span>' + platforms[id].short + '</span>'; }).join('') + '</span>' +
        '</div>';
    }else{
      recent.className = 'empty-state compact';
      recent.innerHTML = '<div class="empty-icon">↗</div><b>Nothing published yet</b><p>Your first SocialTotal post will appear here.</p>';
    }
  }

  function renderAccounts(){
    var host = $('#accountsGrid');
    if(!host) return;
    host.innerHTML = platformOrder.map(function(id){
      var account = state.accounts[id];
      var locked = !planAllows(id);
      var actionLabel = account.connected ? 'Disconnect' : locked ? '$1 plan' : 'Connect';
      return '<article class="account-card">' +
        platformLogo(id) +
        '<div class="account-card-copy"><b>' + platforms[id].name + '</b><span>' +
          (account.connected ? escapeHTML(account.name || 'Connected') : locked ? 'Unlock with Spread or Total' : 'Ready to connect') +
        '</span></div>' +
        '<button class="small-button account-card-action" data-account-action="' + id + '" type="button">' + actionLabel + '</button>' +
      '</article>';
    }).join('');

    $$('[data-account-action]',host).forEach(function(button){
      button.addEventListener('click',function(){
        var id = button.getAttribute('data-account-action');
        if(state.accounts[id].connected) disconnectPlatform(id);
        else requestConnect(id);
      });
    });
  }

  function getCompatibility(media){
    var result = {
      youtube:{ok:false,reason:'Choose a video'},
      tiktok:{ok:false,reason:'Choose media'},
      instagram:{ok:false,reason:'Choose media'},
      facebook:{ok:false,reason:'Choose media'}
    };
    if(!media) return result;

    if(media.kind === 'image'){
      result.youtube = {ok:false,reason:'Video required'};
      result.tiktok = {ok:true,reason:'Photo post'};
      result.instagram = {ok:true,reason:'Image post'};
      result.facebook = {ok:true,reason:'Image post'};
      return result;
    }

    result.youtube = {ok:true,reason:media.duration > 60 ? 'Long-form video' : 'Video / Short'};
    result.tiktok = {ok:true,reason:media.duration > 60 ? 'Long video' : 'Video'};
    var ratio = media.width && media.height ? media.width / media.height : 1;
    var isPortrait = ratio <= .82;
    var isSquareish = ratio > .82 && ratio <= 1.08;
    var short = media.duration <= 60.5;

    if(short && (isPortrait || isSquareish)){
      result.instagram = {ok:true,reason:isPortrait ? 'Reel-ready' : 'Feed video'};
    }else{
      result.instagram = {ok:false,reason:!short ? 'Demo profile routes longer video to YouTube/TikTok' : 'Use portrait or square media'};
    }

    if(short && isPortrait){
      result.facebook = {ok:true,reason:'Reel-ready'};
    }else{
      result.facebook = {ok:false,reason:!short ? 'Demo Reel profile is 60s or less' : 'Use a vertical video'};
    }
    return result;
  }

  function renderDestinations(){
    var host = $('#destinationList');
    if(!host) return;
    var compatibility = getCompatibility(state.media);
    host.innerHTML = platformOrder.map(function(id){
      var check = compatibility[id];
      var allowed = planAllows(id);
      var connected = state.accounts[id].connected;
      var selected = !!state.selected[id];
      var right = '';
      if(!check.ok){
        right = '<span class="incompatible-tag">Not a fit</span>';
      }else if(!allowed){
        right = '<button class="lock-tag" data-upgrade-from="' + id + '" type="button">$1+</button>';
      }else if(!connected){
        right = '<button class="small-button" data-connect-inline="' + id + '" type="button">Connect</button>';
      }else{
        right = '<label class="platform-toggle" aria-label="Publish to ' + platforms[id].name + '"><input data-destination-toggle="' + id + '" type="checkbox" ' + (selected ? 'checked' : '') + '><span></span></label>';
      }
      var classes = 'destination-row';
      if(!check.ok) classes += ' unavailable';
      if(check.ok && !allowed) classes += ' plan-locked';
      return '<div class="' + classes + '">' +
        platformLogo(id) +
        '<span class="destination-copy"><b>' + platforms[id].name + '</b><span>' + escapeHTML(check.reason) + (connected ? ' · ' + escapeHTML(state.accounts[id].name || 'Connected') : '') + '</span></span>' +
        right +
      '</div>';
    }).join('');

    $$('[data-destination-toggle]',host).forEach(function(input){
      input.addEventListener('change',function(){
        var id = input.getAttribute('data-destination-toggle');
        state.selected[id] = input.checked;
        updatePublishState();
      });
    });
    $$('[data-connect-inline]',host).forEach(function(button){
      button.addEventListener('click',function(){ requestConnect(button.getAttribute('data-connect-inline')); });
    });
    $$('[data-upgrade-from]',host).forEach(function(button){
      button.addEventListener('click',function(){
        routeTo('billing');
        toast('Unlock all platforms','Spread is $1/month in the planned pricing model. Demo billing can unlock it now.','info');
      });
    });

    var note = $('#detectionNote');
    if(!state.media){
      note.className = 'detection-note';
      note.innerHTML = '<span class="detect-dot"></span><p>Choose media to run compatibility detection.</p>';
    }else{
      var compatible = platformOrder.filter(function(id){ return compatibility[id].ok; });
      note.className = 'detection-note ok';
      note.innerHTML = '<span class="detect-dot"></span><p>Detected ' + escapeHTML(state.media.kind) + ' · ' + escapeHTML(ratioName(state.media.width,state.media.height)) + ' · fits ' + compatible.length + ' platform' + (compatible.length === 1 ? '' : 's') + ' in this demo profile.</p>';
    }
    updatePublishState();
  }

  function updatePublishState(){
    var selected = platformOrder.filter(function(id){ return !!state.selected[id]; });
    $('#selectedCount').textContent = selected.length + (selected.length === 1 ? ' platform' : ' platforms');
    var button = $('#publishButton');
    var missingConnections = selected.filter(function(id){ return !state.accounts[id].connected; });
    button.disabled = !state.media || !selected.length || !!missingConnections.length;
    if(!state.media){
      $('#publishHint').textContent = 'Choose media first.';
    }else if(!selected.length){
      $('#publishHint').textContent = 'Select at least one connected destination.';
    }else if(missingConnections.length){
      $('#publishHint').textContent = 'Connect every selected destination first.';
    }else{
      $('#publishHint').textContent = 'Ready to publish to ' + selected.length + (selected.length === 1 ? ' destination.' : ' destinations.');
    }
  }

  function selectAvailable(){
    if(!state.media){
      toast('Choose media first','SocialTotal needs the file metadata before it can select compatible platforms.','info');
      return;
    }
    var compatibility = getCompatibility(state.media);
    platformOrder.forEach(function(id){
      state.selected[id] = !!(compatibility[id].ok && planAllows(id) && state.accounts[id].connected);
    });
    renderDestinations();
  }

  function inspectFile(file){
    if(!file) return Promise.reject(new Error('No file selected.'));
    var isImage = file.type.indexOf('image/') === 0;
    var isVideo = file.type.indexOf('video/') === 0;
    if(!isImage && !isVideo) return Promise.reject(new Error('Choose an image or video file.'));

    if(state.media && state.media.objectUrl) URL.revokeObjectURL(state.media.objectUrl);
    var objectUrl = URL.createObjectURL(file);

    return new Promise(function(resolve,reject){
      if(isImage){
        var image = new Image();
        image.onload = function(){
          resolve({
            file:file,
            fileName:file.name,
            size:file.size,
            mime:file.type,
            kind:'image',
            width:image.naturalWidth,
            height:image.naturalHeight,
            duration:0,
            objectUrl:objectUrl
          });
        };
        image.onerror = function(){
          URL.revokeObjectURL(objectUrl);
          reject(new Error('This image could not be read by your browser.'));
        };
        image.src = objectUrl;
      }else{
        var video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = function(){
          resolve({
            file:file,
            fileName:file.name,
            size:file.size,
            mime:file.type,
            kind:'video',
            width:video.videoWidth,
            height:video.videoHeight,
            duration:Number(video.duration) || 0,
            objectUrl:objectUrl
          });
        };
        video.onerror = function(){
          URL.revokeObjectURL(objectUrl);
          reject(new Error('This video format could not be inspected by your browser.'));
        };
        video.src = objectUrl;
      }
    });
  }

  function setMedia(media){
    state.media = media;
    state.selected = {};
    $('#dropEmpty').classList.add('hidden');
    $('#mediaPreview').classList.remove('hidden');
    $('#fileName').textContent = media.fileName;
    $('#fileSize').textContent = formatBytes(media.size);
    $('#mediaTypeFact').textContent = media.kind === 'video' ? 'Video' : 'Image';
    $('#dimensionsFact').textContent = media.width + ' × ' + media.height;
    $('#ratioFact').textContent = ratioName(media.width,media.height);
    $('#durationFact').textContent = media.kind === 'video' ? formatDuration(media.duration) : 'Still';
    var stage = $('#previewStage');
    stage.innerHTML = '';
    var preview = document.createElement(media.kind === 'video' ? 'video' : 'img');
    preview.src = media.objectUrl;
    if(media.kind === 'video'){
      preview.controls = true;
      preview.muted = true;
      preview.playsInline = true;
    }
    stage.appendChild(preview);
    renderDestinations();
    toast('Media detected',media.width + '×' + media.height + ' · ' + ratioName(media.width,media.height) + (media.kind === 'video' ? ' · ' + formatDuration(media.duration) : ''),'success');
  }

  function handleSelectedFile(file){
    inspectFile(file).then(setMedia).catch(function(error){
      toast('Could not read media',error.message,'error');
    });
  }

  function requestConnect(id){
    if(!platforms[id]) return;
    if(!planAllows(id)){
      if($('#appView').classList.contains('hidden')){
        toast('Available on Spread','Instagram and Facebook unlock on the $1 plan. Finish onboarding to view plans.','info');
      }else{
        routeTo('billing');
        toast('Available on Spread','Choose the $1 demo plan to unlock ' + platforms[id].name + '.','info');
      }
      return;
    }
    state.pendingPlatform = id;
    openPermissionModal(id);
  }

  function openPermissionModal(id){
    var modal = $('#permissionModal');
    var def = platforms[id];
    $('#permissionLogo').className = 'platform-logo ' + id;
    $('#permissionLogo').textContent = def.short;
    $('#permissionTitle').textContent = 'Connect ' + def.name;
    $('#permissionDescription').textContent = id === 'youtube'
      ? 'Continue to Google to choose a channel and review SocialTotal’s requested YouTube permissions.'
      : 'SocialTotal will use ' + def.name + '’s supported authorization flow in production.';
    $('#permissionList').innerHTML = def.permissions.map(function(item){
      return '<div class="permission-item"><span class="permission-check">✓</span><div><b>' + escapeHTML(item[0]) + '</b><span>' + escapeHTML(item[1]) + '</span></div></div>';
    }).join('');
    var realReady = providerConfigured(id);
    $('#permissionDemoWarning').classList.toggle('hidden',realReady || !state.demoMode);
    $('#permissionContinue').textContent = realReady ? 'Continue to ' + def.name : state.demoMode ? 'Connect in demo' : 'Provider not configured';
    $('#permissionContinue').disabled = !realReady && !state.demoMode;
    openModal('permissionModal');
  }

  function providerConfigured(id){
    if(id === 'youtube') return !!CONFIG.googleClientId;
    return !!CONFIG.backendBaseUrl;
  }

  function connectPendingPlatform(){
    var id = state.pendingPlatform;
    if(!id) return;
    closeModal('permissionModal');
    if(id === 'youtube' && CONFIG.googleClientId){
      connectYouTube();
      return;
    }
    if(CONFIG.backendBaseUrl && !state.demoMode){
      var returnUrl = window.location.href.split('#')[0];
      window.location.href = CONFIG.backendBaseUrl.replace(/\/$/,'') + '/auth/' + encodeURIComponent(id) + '/start?return=' + encodeURIComponent(returnUrl);
      return;
    }
    simulateConnection(id);
  }

  function setupYouTubeTokenClient(attempt){
    attempt = attempt || 0;
    if(!CONFIG.googleClientId) return;
    if(!window.google || !google.accounts || !google.accounts.oauth2){
      if(attempt < 30) setTimeout(function(){ setupYouTubeTokenClient(attempt + 1); },200);
      return;
    }
    try{
      state.youtubeTokenClient = google.accounts.oauth2.initTokenClient({
        client_id:CONFIG.googleClientId,
        scope:'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
        callback:function(response){
          if(!response || response.error || !response.access_token){
            toast('YouTube connection failed',(response && response.error_description) || (response && response.error) || 'Google did not return an access token.','error');
            return;
          }
          state.youtubeAccessToken = response.access_token;
          fetchYouTubeChannel(response.access_token).then(function(channel){
            state.accounts.youtube.connected = true;
            state.accounts.youtube.name = channel || 'YouTube channel';
            persist();
            renderAll();
            toast('YouTube connected',state.accounts.youtube.name,'success');
          }).catch(function(error){
            state.accounts.youtube.connected = true;
            state.accounts.youtube.name = 'YouTube channel';
            persist();
            renderAll();
            toast('YouTube connected','The upload permission is active, but channel details could not be loaded.','success');
            console.warn(error);
          });
        }
      });
    }catch(error){
      console.warn('YouTube token client setup failed',error);
    }
  }

  function connectYouTube(){
    if(!state.youtubeTokenClient){
      setupYouTubeTokenClient();
      setTimeout(function(){
        if(state.youtubeTokenClient) state.youtubeTokenClient.requestAccessToken({prompt:'consent'});
        else if(state.demoMode) simulateConnection('youtube');
        else toast('Google is not ready','Reload after adding a valid Google OAuth client ID.','error');
      },300);
      return;
    }
    state.youtubeTokenClient.requestAccessToken({prompt:'consent'});
  }

  async function fetchYouTubeChannel(token){
    var response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',{
      headers:{Authorization:'Bearer ' + token}
    });
    if(!response.ok) throw new Error('YouTube channel lookup failed.');
    var data = await response.json();
    return data.items && data.items[0] && data.items[0].snippet ? data.items[0].snippet.title : 'YouTube channel';
  }

  function simulateConnection(id){
    state.accounts[id].connected = true;
    state.accounts[id].name = 'Demo ' + platforms[id].name + ' account';
    persist();
    renderAll();
    toast(platforms[id].name + ' connected','Demo connection saved in this browser.','success');
  }

  function disconnectPlatform(id){
    if(id === 'youtube' && state.youtubeAccessToken && window.google && google.accounts && google.accounts.oauth2){
      try{ google.accounts.oauth2.revoke(state.youtubeAccessToken,function(){}); }catch(error){ console.warn(error); }
      state.youtubeAccessToken = null;
    }
    state.accounts[id].connected = false;
    state.accounts[id].name = '';
    state.selected[id] = false;
    persist();
    renderAll();
    toast(platforms[id].name + ' disconnected','The local connection state was removed.','info');
  }

  async function uploadYouTube(media,title,description,privacy){
    if(!state.youtubeAccessToken) throw new Error('Reconnect YouTube to refresh its upload permission.');
    if(!media || media.kind !== 'video') throw new Error('YouTube demo publishing requires a video.');

    var metadata = {
      snippet:{
        title:title || media.fileName.replace(/\.[^.]+$/,''),
        description:description || '',
        categoryId:'22'
      },
      status:{privacyStatus:privacy || 'private'}
    };

    var start = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{
      method:'POST',
      headers:{
        Authorization:'Bearer ' + state.youtubeAccessToken,
        'Content-Type':'application/json; charset=UTF-8',
        'X-Upload-Content-Length':String(media.file.size),
        'X-Upload-Content-Type':media.mime || 'video/*'
      },
      body:JSON.stringify(metadata)
    });

    if(!start.ok){
      var startText = await start.text();
      throw new Error('YouTube started with an error (' + start.status + '). ' + startText.slice(0,180));
    }
    var location = start.headers.get('Location') || start.headers.get('location');
    if(!location) throw new Error('YouTube did not return a resumable upload URL.');

    var upload = await fetch(location,{
      method:'PUT',
      headers:{
        Authorization:'Bearer ' + state.youtubeAccessToken,
        'Content-Type':media.mime || 'application/octet-stream'
      },
      body:media.file
    });
    if(!upload.ok){
      var uploadText = await upload.text();
      throw new Error('YouTube upload failed (' + upload.status + '). ' + uploadText.slice(0,180));
    }
    return upload.json();
  }

  async function publishViaBackend(id){
    if(!CONFIG.backendBaseUrl) throw new Error('Production backend is not configured.');
    var data = new FormData();
    data.append('media',state.media.file,state.media.fileName);
    data.append('title',$('#postTitle').value || '');
    data.append('caption',$('#postCaption').value || '');
    data.append('platform',id);
    var response = await fetch(CONFIG.backendBaseUrl.replace(/\/$/,'') + '/api/publish/' + encodeURIComponent(id),{
      method:'POST',
      credentials:'include',
      body:data
    });
    if(!response.ok) throw new Error(platforms[id].name + ' backend returned ' + response.status + '.');
    return response.json();
  }

  async function publishSelected(){
    var selected = platformOrder.filter(function(id){ return !!state.selected[id]; });
    if(!state.media || !selected.length) return;

    var modal = $('#publishModal');
    $('#publishTitle').textContent = 'Spreading your post…';
    $('#publishDescription').textContent = 'Keep this tab open while connected platforms receive your media.';
    $('#publishDoneButton').classList.add('hidden');
    var list = $('#publishProgressList');
    list.innerHTML = selected.map(function(id){
      return '<div class="publish-progress-row" data-publish-row="' + id + '">' +
        platformLogo(id) +
        '<span class="progress-copy"><b>' + platforms[id].name + '</b><span>' + escapeHTML(state.accounts[id].name || 'Connected') + '</span></span>' +
        '<span class="progress-state">Waiting</span>' +
      '</div>';
    }).join('');
    openModal('publishModal');

    var results = {};
    for(var i=0;i<selected.length;i++){
      var id = selected[i];
      var row = $('[data-publish-row="' + id + '"]',list);
      var status = $('.progress-state',row);
      status.textContent = 'Publishing…';
      try{
        if(id === 'youtube' && state.youtubeAccessToken){
          await uploadYouTube(state.media,$('#postTitle').value,$('#postCaption').value,$('#youtubePrivacy').value);
        }else if(CONFIG.backendBaseUrl && !state.demoMode){
          await publishViaBackend(id);
        }else{
          await sleep(650 + i * 160);
        }
        results[id] = 'published';
        status.textContent = state.demoMode && !(id === 'youtube' && state.youtubeAccessToken) ? 'Demo published' : 'Published';
        status.className = 'progress-state success';
      }catch(error){
        results[id] = 'failed';
        status.textContent = 'Needs attention';
        status.className = 'progress-state error';
        $('.progress-copy span',row).textContent = error.message.slice(0,100);
      }
    }

    var failed = selected.filter(function(id){ return results[id] === 'failed'; });
    var record = {
      id:Date.now(),
      title:($('#postTitle').value || '').trim(),
      fileName:state.media.fileName,
      kind:state.media.kind,
      platforms:selected,
      results:results,
      status:failed.length ? 'failed' : 'published',
      when:new Date().toLocaleString()
    };
    state.history.unshift(record);
    state.history = state.history.slice(0,100);
    persist();
    renderHome();
    renderLibrary();
    renderAnalytics();

    if(failed.length){
      $('#publishTitle').textContent = 'Finished with ' + failed.length + ' issue' + (failed.length === 1 ? '' : 's') + '.';
      $('#publishDescription').textContent = 'Successful destinations are saved. Reconnect or retry destinations that need attention.';
    }else{
      $('#publishTitle').textContent = 'Spread complete.';
      $('#publishDescription').textContent = 'Your publish result has been saved to the SocialTotal library.';
    }
    $('#publishDoneButton').classList.remove('hidden');
  }

  function renderLibrary(filter){
    filter = filter || ($('#libraryTabs .active') ? $('#libraryTabs .active').getAttribute('data-library-filter') : 'all');
    var host = $('#libraryList');
    if(!host) return;
    var items = state.history.filter(function(item){
      return filter === 'all' || item.status === filter;
    });
    if(!items.length){
      host.innerHTML = '<div class="library-empty">' + (state.history.length ? 'No posts match this filter.' : 'Your publishing history will show up here after the first post.') + '</div>';
      return;
    }
    host.innerHTML = items.map(function(item){
      return '<article class="library-item">' +
        '<span class="library-thumb">' + (item.kind === 'image' ? 'IMG' : 'VID') + '</span>' +
        '<span class="library-copy"><b>' + escapeHTML(item.title || item.fileName || 'Untitled post') + '</b><span>' + escapeHTML(item.when) + ' · ' + (item.status === 'failed' ? 'Needs attention' : 'Published') + '</span></span>' +
        '<span class="library-platforms">' + item.platforms.map(function(id){ return '<span title="' + platforms[id].name + '">' + platforms[id].short + '</span>'; }).join('') + '</span>' +
      '</article>';
    }).join('');
  }

  function renderAnalytics(){
    var host = $('#platformBars');
    if(!host) return;
    var counts = {youtube:0,tiktok:0,instagram:0,facebook:0};
    var destinations = 0;
    state.history.forEach(function(item){
      item.platforms.forEach(function(id){
        if(typeof counts[id] === 'number') counts[id] += 1;
        destinations += 1;
      });
    });
    $('#statPosts').textContent = state.history.length;
    $('#statDestinations').textContent = destinations;
    $('#statConnected').textContent = connectedCount();
    var max = Math.max(1,counts.youtube,counts.tiktok,counts.instagram,counts.facebook);
    host.innerHTML = platformOrder.map(function(id){
      var percent = Math.round((counts[id] / max) * 100);
      return '<div class="platform-bar-row"><span>' + platforms[id].name + '</span><div class="platform-bar-track"><div class="platform-bar-fill" style="width:' + percent + '%"></div></div><b>' + counts[id] + '</b></div>';
    }).join('');
  }

  function renderBilling(){
    $$('[data-plan-card]').forEach(function(card){
      card.classList.toggle('current',card.getAttribute('data-plan-card') === state.plan);
    });
    $$('.plan-button').forEach(function(button){
      var current = button.getAttribute('data-plan') === state.plan;
      button.textContent = current ? 'Current plan' : button.getAttribute('data-plan') === 'free' ? 'Use Free' : button.getAttribute('data-plan') === 'spread' ? 'Choose Spread' : 'Choose Total';
      button.disabled = current;
    });
  }

  function setPlan(plan){
    if(['free','spread','total'].indexOf(plan) === -1) return;
    state.plan = plan;
    if(plan === 'free'){
      state.selected.instagram = false;
      state.selected.facebook = false;
    }
    persist();
    renderAll();
    toast(planLabel() + ' active','Demo plan changed locally. No payment was collected.','success');
  }

  function updateAds(){
    var show = state.plan !== 'total';
    $$('[data-ad-slot]').forEach(function(slot){ slot.classList.toggle('hidden',!show); });
    if(show && CONFIG.adsenseClient && CONFIG.adsenseSlot && !document.querySelector('script[data-socialtotal-ads]')){
      var script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.socialtotalAds = '1';
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(CONFIG.adsenseClient);
      document.head.appendChild(script);
    }
  }

  function openModal(id){
    var modal = $('#' + id);
    if(!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
  }

  function closeModal(id){
    var modal = $('#' + id);
    if(!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
  }

  function ensureLiquid(container){
    if(!container || container.dataset.liquidReady) return;
    container.dataset.liquidReady = '1';
    var goo = document.createElement('span');
    goo.className = 'liquid-goo';
    goo.innerHTML = '<span class="liquid-bridge"></span><span class="liquid-blob"></span>';
    var indicator = document.createElement('span');
    indicator.className = 'liquid-indicator';
    container.prepend(indicator);
    container.prepend(goo);
  }

  function positionLiquid(container,active){
    if(!container || !active) return;
    ensureLiquid(container);
    var indicator = $('.liquid-indicator',container);
    var blob = $('.liquid-blob',container);
    var containerRect = container.getBoundingClientRect();
    var activeRect = active.getBoundingClientRect();
    var x = activeRect.left - containerRect.left;
    var width = activeRect.width;
    indicator.style.width = width + 'px';
    indicator.style.transform = 'translateX(' + x + 'px)';
    blob.style.left = x + 'px';
    blob.style.width = width + 'px';
  }

  function initLiquidTabs(){
    $$('[data-liquid-tabs]').forEach(function(container){
      ensureLiquid(container);
      var buttons = $$('button',container);
      buttons.forEach(function(button){
        button.addEventListener('click',function(){
          buttons.forEach(function(item){ item.classList.toggle('active',item === button); });
          positionLiquid(container,button);
          if(button.hasAttribute('data-library-filter')) renderLibrary(button.getAttribute('data-library-filter'));
        });
      });
      requestAnimationFrame(function(){
        positionLiquid(container,$('.active',container) || buttons[0]);
      });
    });
    window.addEventListener('resize',function(){
      $$('[data-liquid-tabs]').forEach(function(container){
        positionLiquid(container,$('.active',container) || $('button',container));
      });
    });
  }

  function resetDemo(){
    if(state.media && state.media.objectUrl) URL.revokeObjectURL(state.media.objectUrl);
    localStorage.removeItem(STORAGE_KEY);
    state.profile = null;
    state.plan = 'free';
    state.accounts = {
      youtube:{connected:false,name:''},
      tiktok:{connected:false,name:''},
      instagram:{connected:false,name:''},
      facebook:{connected:false,name:''}
    };
    state.history = [];
    state.media = null;
    state.selected = {};
    state.youtubeAccessToken = null;
    state.demoMode = CONFIG.demoMode !== false;
    closeModal('settingsModal');
    showView('auth');
    resetComposer();
    renderAll();
    toast('Demo reset','Local SocialTotal data was cleared.','success');
  }

  function resetComposer(){
    $('#mediaInput').value = '';
    $('#dropEmpty').classList.remove('hidden');
    $('#mediaPreview').classList.add('hidden');
    $('#previewStage').innerHTML = '';
    $('#postTitle').value = '';
    $('#postCaption').value = '';
    $('#captionCount').textContent = '0 / 2,200';
    renderDestinations();
  }

  function bindEvents(){
    $$('[data-route]').forEach(function(button){
      button.addEventListener('click',function(){ routeTo(button.getAttribute('data-route')); });
    });

    $('#googleFallbackButton').addEventListener('click',function(){
      if(CONFIG.googleClientId && window.google && google.accounts && google.accounts.id){
        google.accounts.id.prompt();
      }else{
        demoLogin('Google','creator@gmail.demo');
      }
    });

    $('#discordLoginButton').addEventListener('click',function(){
      if(CONFIG.backendBaseUrl && CONFIG.discordClientId && !state.demoMode){
        window.location.href = CONFIG.backendBaseUrl.replace(/\/$/,'') + '/auth/discord/start?return=' + encodeURIComponent(window.location.href);
      }else{
        demoLogin('Discord','creator@discord.demo');
      }
    });

    $('#emailLoginForm').addEventListener('submit',function(event){
      event.preventDefault();
      var email = $('#emailInput').value.trim();
      if(email) demoLogin('Email',email);
    });

    $$('[data-connect]','#onboardingPlatforms').forEach(function(card){
      card.addEventListener('click',function(){ requestConnect(card.getAttribute('data-connect')); });
    });

    $('#skipOnboarding').addEventListener('click',enterApp);
    $('#finishOnboarding').addEventListener('click',enterApp);
    $('#quickConnectButton').addEventListener('click',function(){ routeTo('accounts'); });
    $('#profileButton').addEventListener('click',function(){ openModal('settingsModal'); });
    $('#settingsButton').addEventListener('click',function(){ openModal('settingsModal'); });

    $('#permissionContinue').addEventListener('click',connectPendingPlatform);
    $$('[data-close-modal]').forEach(function(button){
      button.addEventListener('click',function(){ closeModal(button.getAttribute('data-close-modal')); });
    });

    $('#demoModeToggle').addEventListener('change',function(){
      state.demoMode = $('#demoModeToggle').checked;
      persist();
      toast('Demo mode ' + (state.demoMode ? 'on' : 'off'),state.demoMode ? 'Unconfigured providers will be simulated.' : 'Unconfigured providers will be blocked.','info');
    });
    $('#resetDemoButton').addEventListener('click',resetDemo);

    var dropZone = $('#dropZone');
    var mediaInput = $('#mediaInput');
    dropZone.addEventListener('click',function(event){
      if(event.target.closest('#replaceMediaButton') || event.target.closest('video')) return;
      mediaInput.click();
    });
    dropZone.addEventListener('keydown',function(event){
      if(event.key === 'Enter' || event.key === ' '){
        event.preventDefault();
        mediaInput.click();
      }
    });
    mediaInput.addEventListener('change',function(){ handleSelectedFile(mediaInput.files && mediaInput.files[0]); });
    $('#replaceMediaButton').addEventListener('click',function(event){
      event.stopPropagation();
      mediaInput.click();
    });
    ['dragenter','dragover'].forEach(function(name){
      dropZone.addEventListener(name,function(event){
        event.preventDefault();
        dropZone.classList.add('dragging');
      });
    });
    ['dragleave','drop'].forEach(function(name){
      dropZone.addEventListener(name,function(event){
        event.preventDefault();
        dropZone.classList.remove('dragging');
      });
    });
    dropZone.addEventListener('drop',function(event){
      var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if(file) handleSelectedFile(file);
    });

    $('#postCaption').addEventListener('input',function(){
      $('#captionCount').textContent = $('#postCaption').value.length.toLocaleString() + ' / 2,200';
    });
    $('#selectAvailableButton').addEventListener('click',selectAvailable);
    $('#publishButton').addEventListener('click',publishSelected);
    $('#publishDoneButton').addEventListener('click',function(){
      closeModal('publishModal');
      routeTo('library');
    });

    $$('.plan-button').forEach(function(button){
      button.addEventListener('click',function(){ setPlan(button.getAttribute('data-plan')); });
    });

    document.addEventListener('keydown',function(event){
      if(event.key !== 'Escape') return;
      ['permissionModal','settingsModal'].forEach(function(id){
        if(!$('#' + id).classList.contains('hidden')) closeModal(id);
      });
    });
  }

  function init(){
    loadState();
    bindEvents();
    initLiquidTabs();
    initGoogleSignIn();
    setupYouTubeTokenClient();
    if(state.profile){
      showView('app');
      routeTo('home');
    }else{
      showView('auth');
    }
    renderAll();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
