/*
 * Hypnotic can be extended.
 * In this example,
 * A simple semaphore is introduced,
 * which supports only one producer/consumer
 * 
 * This script should be run outside Hypnotic!
 */

function SemaphoreOne() { }
 
SemaphoreOne.prototype = {
    /*
     * Wrap a normal function with Hypnotic.
     * When this function is called,
     * Hypnotic would insert its own callback function as the first argument,
     * it will then go to sleep until the callbackk function is called
     */
    wait: new Hypnotic(function(cb) {
        window.sema_out = this;
        this.cb = cb;
    }),
    release: function() {
        if(this.cb) {
            var cb = this.cb;
            this.cb = null;
            cb();
        }
    }
};

