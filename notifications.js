(function(){
    // Create container
    const container = document.createElement('div');
    container.className = 'notify-container';
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(container));

    // Show a simple toast notification
    window.showNotification = function(message, type='info', options={duration:5000, actionText:null, actionCallback:null}){
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;

        const msg = document.createElement('div');
        msg.className = 'toast-message';
        msg.innerText = message;
        toast.appendChild(msg);

        if(options.actionText){
            const actionBtn = document.createElement('button');
            actionBtn.className = 'toast-action';
            actionBtn.innerText = options.actionText;
            actionBtn.addEventListener('click', () => {
                try { options.actionCallback && options.actionCallback(); }
                catch(e){ console.error(e); }
                if(toast.parentNode) toast.parentNode.removeChild(toast);
            });
            toast.appendChild(actionBtn);
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.innerHTML = '\u00d7';
        closeBtn.addEventListener('click', () => { if(toast.parentNode) toast.parentNode.removeChild(toast); });
        toast.appendChild(closeBtn);

        // If DOM not yet ready, wait for DOMContentLoaded
        if(document.body) container.appendChild(toast);
        else document.addEventListener('DOMContentLoaded', () => container.appendChild(toast));

        const duration = options.duration || 5000;
        if(duration > 0){ setTimeout(() => { if(toast.parentNode) toast.parentNode.removeChild(toast); }, duration); }

        return toast;
    };

    // Show a confirm-style toast (returns Promise<boolean>)
    window.showConfirm = function(message, options={confirmText:'Yes', cancelText:'No', duration:0}){
        return new Promise((resolve) => {
            const toast = document.createElement('div');
            toast.className = 'toast confirm';

            const msg = document.createElement('div');
            msg.className = 'toast-message';
            msg.innerText = message;
            toast.appendChild(msg);

            const actions = document.createElement('div');
            actions.className = 'confirm-actions';

            const yes = document.createElement('button');
            yes.className = 'btn-yes';
            yes.innerText = options.confirmText;
            yes.addEventListener('click', () => { if(toast.parentNode) toast.parentNode.removeChild(toast); resolve(true); });

            const no = document.createElement('button');
            no.className = 'btn-no';
            no.innerText = options.cancelText;
            no.addEventListener('click', () => { if(toast.parentNode) toast.parentNode.removeChild(toast); resolve(false); });

            actions.appendChild(yes);
            actions.appendChild(no);
            toast.appendChild(actions);

            if(document.body) container.appendChild(toast);
            else document.addEventListener('DOMContentLoaded', () => container.appendChild(toast));

            if(options.duration && options.duration > 0){
                setTimeout(() => { if(toast.parentNode) { toast.parentNode.removeChild(toast); resolve(false); } }, options.duration);
            }
        });
    };

})();