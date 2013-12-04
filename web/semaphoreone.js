/*
 * In this example,
 * we introduce a simple semphore that supports only one producer/consumer
 * 
 * This script should be run outside Hypnotic!
 */

function SemaphoreOne() {
}
 
SemaphoreOne.prototype = {
    /*
     * Wrap a normal function with Hypnotic.
     * When this function is called,
     * Hypnotic would insert its own callback function as the first argument,
     * it will then go to sleep until the callbackk function is called
     */
    wait: new Hypnotic(function(cb) {
        console.log('wait');
        window.sema_out = this;
        this.cb = cb;
    }),
    release: function() {
        console.log(this.cb);
        if(this.cb) {
            var cb = this.cb;
            this.cb = null;
            cb();
        }
    }
};
