import BbPromise from 'bluebird';

const THE_MESSAGE = 'Hello from the webpack 4 sample';

export class App {
  static handleFirst(event) {
    const myDemoResult = {
      message: App.THE_MESSAGE,
      from: 'First lambda ;-)',
      event
    };

    return BbPromise.resolve(myDemoResult);
  }

  static handleSecond(event) {
    const myDemoResult = {
      message: THE_MESSAGE,
      from: 'Second lambda ;-)',
      event
    };

    return BbPromise.resolve(myDemoResult);
  }
}
