import { Readable } from 'stream';
import * as portAudio from 'naudiodon';
import { flow, sum } from 'lodash';

const bpm = 44100;

// Create an instance of AudioIO with outOptions (defaults are as below), which will return a WritableStream
// @ts-ignore
var ao = new portAudio.AudioIO({
  outOptions: {
    channelCount: 1,
    sampleFormat: portAudio.SampleFormat8Bit,
    sampleRate: bpm,
    deviceId: -1, // Use -1 or omit the deviceId to select the default device
    closeOnError: true // Close the stream if an audio error is detected, if set false then just log the error
  }
});

type Gen<T = number> = { next: () => T };

const sin = (f: number): Gen => {
  let i = 0;

  return {
    next() {
      const value = (Math.sin(i * 2 * f * Math.PI / bpm)) * 127;

      i += 1;

      return value;
    }
  };
}

const merge = (gens: Gen[]): Gen => ({
  next() {
    let result = 0;

    for (let i = 0; i < gens.length; i += 1) {
      result += gens[i].next();
    }

    return result / gens.length;
  }
});

const toBuffer = (gen: Gen): Gen<Buffer> => ({
  next() {
    const value = gen.next();

    return Buffer.from([value]);
  }
});

const intervaler = (secs: number) => (gen: Gen): Gen => {
  let i = 0;

  const silence = bpm * secs;
  const restart = bpm * secs * 2;

  return {
    next() {
      i += 1;

      if (i === restart) {
        i = 0;
      }

      return i < silence ? gen.next() : 0;
    }
  }
}

const streamAdapter = (gen: Gen<Buffer>): Iterable<Buffer> => ({
  [Symbol.iterator]() {
    return {
      next() {
        return {
          value: gen.next(),
        }
      }
    }
  }
});

const rs = Readable.from(
  flow(
    merge,
    intervaler(1),
    toBuffer,
    streamAdapter,
  )([220, 440, 528, 660, 880, 1100, 1320, 1830].map(f => sin(f)))
);

// Start piping data and start streaming
rs.pipe(ao);
ao.start();