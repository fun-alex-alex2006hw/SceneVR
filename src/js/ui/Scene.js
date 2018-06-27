// const UI = require('../ui/ui.js');
const data = require('../data/data.js');
const dom = require('../utils/dom.js');
const Stage = require('../ui/Stage.js');
const Pano = require('../ui/Pano.js');
const Chrome = require('../ui/Chrome.js');
const isMobile = require('../utils/isMobile.js');
import {TweenLite, CSSPlugin} from "gsap/all";

module.exports = class Scene {
    constructor(config) {
        this.config = config;
        this.allow_mouse_hover_movement = true;
        this.el = {
            container: {},
            ui: {},
            loading: document.getElementById("svr-loading")
        };
        this._stereo = false;
        this.current_pano = 0;
        this.panos = [];
        this.user_interacting = false;
        this.user_first_interaction = false;
        this.temp_ui_active = true;
        this.pointer = {
            down_x: 0,
            down_y: 0,
            move_x: 0,
            move_y: 0,
            lat: 0,
            lon: 0,
            down_lon: 0,
            down_lat: 0,
            timer:0
        };
        this.animate_camera = new TweenLite(this.pointer);
        this.loaded = [];
        console.debug(`Is Mobile Device = ${isMobile.any}`)

        // LOAD DATA
        data.getJSON(this.config.source).then(
            response => {
                this.data = response;
                this.buildTemplate();
                this.startListening();
                this.buildPanos();
                this.updateSize();
            },
            response => {
                console.error("FAILED TO LOAD DATA");
                console.log(response);
            }
        )


    }

    buildTemplate() {
        this.el.container = dom.createElement('section', 'scene-vr');

        if (isMobile.any) {
            this.el.container.classList.add("svr-mobile");
        }

        document.body.appendChild(this.el.container);

        this.stage = new Stage(this.config, this.el.container);
        this.chrome = new Chrome(this.data, this.el.container);

    }

    startListening() {
        this.stage.el.addEventListener('mousedown', (e) => {this.onMouseDown(e)});
        this.stage.el.addEventListener('mouseup', (e) => {this.onMouseUp(e)});

        if (!isMobile.any && this.allow_mouse_hover_movement) {
            this.el.container.addEventListener('mousemove', (e) => {this.onMouseMove(e)});
        }

        if (isMobile.any) {
            this.stage.el.addEventListener('touchstart', (e) => {this.onTouchStart(e)});
            this.stage.el.addEventListener('touchmove', (e) => {this.onTouchMove(e)});
            this.stage.el.addEventListener('touchend', (e) => {this.onTouchEnd(e)});
        }

        this.chrome.events.addListener("fullscreen", (e) => {
            this.fullScreenToggle(e);
        })

        this.chrome.events.addListener("cardboard", (e) => {
            this.cardboardToggle(e);
        })

        this.chrome.events.addListener("goto", (e) => {
            this.goTo(e.number);

        })

    }

    fullScreenToggle(e) {
        let fullscreenElement = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement;

        if (!fullscreenElement) {
            this.chrome.fullscreen = true;
            if (this.el.container.requestFullscreen) {
                this.el.container.requestFullscreen();
            } else if (this.el.container.webkitRequestFullscreen) {
                this.el.container.webkitRequestFullscreen();
            } else if (this.el.container.mozRequestFullScreen) {
                this.el.container.mozRequestFullScreen();
            } else if (this.el.container.msRequestFullscreen) {
                this.el.container.msRequestFullscreen();
            }
        } else {
            this.chrome.fullscreen = false;
            if(document.exitFullscreen) {
                document.exitFullscreen();
            } else if(document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if(document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }

        }

        this.updateSize();
    }

    cardboardToggle(e) {
        if (this.stereo) {
            this.stereo = false;
        } else {
            this.stereo = true;
        }
    }

    onTouchStart(e) {
        this.animate_camera.kill();
        // console.debug("touch start")
        let touch = event.touches[ 0 ];
        this.pointer.timer = new Date();
        this.pointer.down_x = touch.screenX;
        this.pointer.down_y = touch.screenY;
        this.pointer.move_x = touch.screenX;
        this.pointer.move_y = touch.screenY;
        this.pointer.down_lon = 0;
        this.pointer.down_lat = 0;
    }

    onTouchMove(e) {
        // console.debug("touch move")
        let touch = event.touches[ 0 ];
        this.pointer.lon -= ( touch.screenX - this.pointer.move_x ) * 0.1;
        this.pointer.lat += ( touch.screenY - this.pointer.move_y ) * 0.1;
        this.pointer.move_x = touch.screenX;
        this.pointer.move_y = touch.screenY;
        this.stage.updateCameraTarget(this.pointer.lon, this.pointer.lat);
        if (this.chrome.active) {
            this.chrome.toggleUI(true);
        }
        // console.debug(`this.pointer.lon ${this.pointer.lon} this.pointer.lat ${this.pointer.lat}`);
    }

    onTouchEnd(e) {
        // console.debug("touch end")
        // let touch = event.touches[ 0 ],
        //     timer = new Date(),
        //     time_part = (timer - this.pointer.timer) / 500,
        //     change_lon = (this.pointer.lon * 1) ,
        //     change_lat = (this.pointer.lat * 1);
        //
        // console.debug(`change_lon ${this.pointer.lon + (change_lon/time_part)} change_lat ${this.pointer.lat + (change_lat/time_part)}`);
        //
        // this.animate_camera.kill();
        // this.animate_camera = new TweenLite(this.pointer, time_part, {lon:change_lon, lat:change_lat ,onUpdate:(e) => {
        //     this.stage.updateCameraTarget(this.pointer.lon, this.pointer.lat);
        // }})

    }

    onMouseMove(e) {
        if (!this.user_first_interaction) {
            this.pointer.move_x = e.clientX;
            this.pointer.move_y = e.clientY;
            let change_lon = (e.clientX * 0.1)/8;
            let change_lat = (e.clientY * 0.1)/8;

            this.animate_camera = new TweenLite(this.pointer, 1, {lon:change_lon, lat:change_lat ,onUpdate:(e) => {
                this.stage.updateCameraTarget(this.pointer.lon, this.pointer.lat);
            }})
        } else {
            if (this.user_interacting && this.chrome.active) {
                let pointer_x = Math.abs(this.pointer.down_x - e.clientX);
                let pointer_y = Math.abs(this.pointer.down_y - e.clientY);
                if (pointer_x > 10 || pointer_y > 10 ) {
                    this.chrome.toggleUI(true);
                }
            }
        }
    }

    onMouseDown(e) {
        if (!this.user_interacting) {
            this.user_interacting = true;
            this.user_first_interaction = true;
            this.temp_ui_active = this.chrome.active;
            console.debug("remove onMouseMove listener")
            this.el.container.removeEventListener('mousemove', (e) => {console.log(e)});

        }
        this.pointer.down_x = e.clientX;
        this.pointer.down_y = e.clientY;
        this.animate_camera.kill();

    }

    onMouseUp(e) {
        this.user_interacting = false;
        let pointer_x = Math.abs(this.pointer.down_x - e.clientX);
        let pointer_y = Math.abs(this.pointer.down_y - e.clientY);

        if (pointer_x < 10 && pointer_y < 10 ) {
            this.chrome.toggleUI();
        } else if (this.temp_ui_active) {
            this.chrome.toggleUI(false);
        }
    }

    buildPanos() {
        for (let i = 0; i < this.data.scenes.length; i++) {
            let pano = new Pano(this.data.scenes[i]);
            pano.events.addListener("thumbnail_loaded", (e) => {
                this.onThumbnailLoaded(e, i)
            })
            this.panos.push(pano);
            this.stage.addPano(pano);
        }
        this.panos[this.current_pano].active = true;
    }

    onThumbnailLoaded(e, i) {
        if (i === 0) {
            this.el.loading.style.display = "none";
        }
    }

    goTo(n) {
        this.panos[this.current_pano].active = false;
        this.current_pano = n;
        this.panos[this.current_pano].active = true;
        this.user_interacting = false;
        this.user_first_interaction = false;
    }

    get stereo() {
        return this._stereo;
    }

    set stereo(s) {
        this._stereo = s;
        this.stage.stereo = this._stereo;
        this.chrome.vr = this._stereo;
    }

    render() {
        if(this.stage) {
            this.stage.render();
        }
        if (this.chrome) {
            this.chrome.compass = Math.round(-this.stage.camera_angle-180);
        }

    }

    updateSize() {
        if(this.stage){
            this.stage.updateSize();
            this.chrome.updateSize();
        }
    }

    appendStage() {
        this.el.loading.style.visibility = "hidden";
        this.el.container.appendChild(this.el.ui);
    }


}
