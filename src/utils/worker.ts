
class worker_data {
    public name: string;
    public params: any[];
    public current_index : number;
    public max_index: number;
    public callback: (param: any) => void;
    public done: () => void;
    constructor(name: string, p: any[], max: number, callback: (param: any) => void, done: () => void) {
        this.name = name;
        this.params = p;
        this.current_index = 0;
        this.max_index = max;
        this.callback = callback;
        this.done = done;
    }
}

export function CreateWorker(name: string, params: any[], callback: (param: any) => void, done: () => void) {
    if (params.length === 0) {
        return;
    }


    var current_visitor = (data: worker_data) => {
        var p = data.params[data.current_index];
        data.callback(p);
        data.current_index++;
        if (data.current_index > data.max_index) {
            done();
            return;
        }
        setImmediate(current_visitor, data);
    };

    var stop_index = params.length - 1;
    var d = new worker_data(name, params, stop_index, callback, done);

    setImmediate(current_visitor, d);
}