const path = require('path');
const fs = require('fs');
const _ = require('lodash');

const statsFileName = 'stats.json';

function loadStatsFromFile(webpackOutputPath) {
  const statsFile = path.join(webpackOutputPath, statsFileName);
  const data = fs.readFileSync(statsFile);
  const stats = JSON.parse(data);

  if (!stats.stats || !stats.stats.length) {
    throw new this.serverless.classes.Error('Packaging: No stats information found');
  }

  const mappedStats = _.map(stats.stats, s =>
    _.assign({}, s, { outputPath: path.resolve(webpackOutputPath, s.outputPath) })
  );

  return { stats: mappedStats };
}

module.exports = {
  get() {
    const stats = this.stats || loadStatsFromFile.call(this, this.webpackOutputPath);

    return stats;
  },
  save(stats) {
    this.stats = stats;

    const statsJson = _.invokeMap(this.stats.stats, 'toJson');

    const normalisedStats = _.map(statsJson, s => {
      return _.assign(s, { outputPath: path.relative(this.webpackOutputPath, s.outputPath) });
    });

    fs.writeFileSync(path.join(this.webpackOutputPath, statsFileName), JSON.stringify(normalisedStats, null, 2));

    return;
  }
};
