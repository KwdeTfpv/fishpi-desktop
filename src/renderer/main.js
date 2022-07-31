import { Menu, getCurrentWindow } from '@electron/remote';

import ipc from './ipc'
import Setting from './setting'

import Vue from 'vue'
import VueWorker from 'vue-worker'
import FishPi from 'fishpi';

import App from './App'
import router from './router'
import store from './store'
import axios from 'axios';

import iView from 'view-design'
import 'view-design/dist/styles/iview.css'
import './theme/theme.css'
import './theme/index.css'
import './theme/font-awesome.css'
import './theme/highlight.css'

Vue.use(iView)
Vue.use(VueWorker)
Vue.locale = () => { };

if (!process.env.IS_WEB) Vue.use(require('vue-electron'))
Vue.config.productionTip = false
Vue.config.devtools = true;

Vue.prototype.$ipc = ipc;
Vue.prototype.$fishpi = new FishPi();
Vue.prototype.$http = axios;

router.beforeEach((to, from, next) => {
    if (!to.meta.notitle && to.meta.title) {
        if (window.$VueApp) window.$VueApp.title = to.meta.title;
    }
    else {
        if (window.$VueApp) window.$VueApp.title = '';
    }
    next();
});

/* eslint-disable no-new */
window.$VueApp = new Vue({
    components: { App },
    router,
    store,
    template: '<App/>',
    mounted() {
        this.title = document.title;
        this.$fishpi.setToken(localStorage.getItem('token'));

        window.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (e.target.dataset.menu != 'true') return e.stopPropagation();
            this.popupMenu(this.defaultMenu);
        }, false)

        document.addEventListener('click', (ev) => {
            let img = ev.target;
            if (img.nodeName.toLowerCase() != 'img' || img.className == 'emoji' || img.dataset.action != 'preview') return;
            let size = {
                width: img.naturalWidth,
                height: img.naturalHeight,
            }
            this.$ipc.send('main-event', { call: 'openImage', args: { url: img.src, size }});
        });
        
        new BroadcastChannel('main-router').addEventListener("message", ({ data }) => {
            if(!data.url) return;
            this.$router.push(data.url);
        }, false);

    },
    data: {
        token: localStorage.getItem('token') || '',
        setting: new Setting(),
        title: '摸鱼派桌面客户端',
        liveness: 0,
        current: null,
        onlines: [],
        playSongs:[],
        playIndex: 0,
        defaultMenu: [{
            label: '复制',
            role: 'copy',
            accelerator: 'CmdOrCtrl+C',
        },{
            label: '粘贴',
            role: 'paste',
            accelerator: 'CmdOrCtrl+V',
        }],
    },
    computed: {
        currentMusic() {
            return this.playSongs[this.playIndex];
        }
    },
    methods: {
        isLogin() {
            return !!this.token;
        },
        async logout() {
            this.current = null;
            this.token = null;
            this.$fishpi.setToken(null);
            localStorage.removeItem('token');
            this.$router.push('/login');
        },
        async login(account) {
            let rsp = await this.$fishpi.login(account);
            if (!rsp) return;
            if (rsp.code != 0) {
                throw(new Error(rsp.msg));
            }
            this.token = rsp.Key;
            localStorage.setItem('token', rsp.Key);
            return await this.getInfo();
        },
        async getInfo() {
            let rsp = await this.$fishpi.account.info();
            if (rsp.code != 0) {
                throw(rsp.msg);
            }
            this.current = rsp.data;
            return rsp.data;
        },
        getElementPosition(element) {
            let actualLeft = element.offsetLeft;
            let current = element.offsetParent;
                
            while (current !== null){
                actualLeft += current.offsetLeft;
                current = current.offsetParent;
            }
                
                
            let actualTop = element.offsetTop;
            current = element.offsetParent;
                
            while (current !== null){
                actualTop += current.offsetTop;
                current = current.offsetParent;
            }
            
            return {
                x: actualLeft,
                y: actualTop,
            }
        },
        popupMenu(menu) {
            Menu.buildFromTemplate(menu).popup({ window: getCurrentWindow() })
        },
        prevSong() {
            this.playIndex = (this.playIndex - 1 + this.playSongs.length) % this.playSongs.length
        },
        nextSong() {
            this.playIndex = (this.playIndex + 1) % this.playSongs.length
        },
        delSong() {
            this.playSongs.splice(this.playIndex, 1)
            this.nextSong()
        },
        inPlayList(id) {
            return this.playSongs.find(p => p.id == id) != null
        },
        removeSong(id) {
            this.playSongs = this.playSongs.filter(p => p.id != id)
            if(this.playIndex >= this.playSongs.length) this.playIndex = 0;
        },
        async playMusic(id, push) {
            let infoApi = `http://music.163.com/api/song/detail/?id=${id}&ids=%5B${id}%5D`; 
            let rsp = await this.$http.get(infoApi);
            rsp = rsp.data;
            if (rsp.code != 200 || !rsp.songs.length) return;
            if(!push) this.playSongs = [{
                id,
                artist: rsp.songs[0].artists.map(a => a.name).join(','),
                name: rsp.songs[0].name,
                img: rsp.songs[0].album.picUrl,
                url: `http://music.163.com/song/media/outer/url?id=${id}`
            }];
            else if(!this.playSongs.find(p => p.id == id)) this.playSongs.push({
                id,
                artist: rsp.songs[0].artists.map(a => a.name).join(','),
                name: rsp.songs[0].name,
                img: rsp.songs[0].album.picUrl,
                url: `http://music.163.com/song/media/outer/url?id=${id}`
            });
            if(this.playIndex >= this.playSongs.length) this.playIndex = 0;
        },
    },
    watch: {
        title(val) {
            document.title = val;
        }
    }
}).$mount('#app')
