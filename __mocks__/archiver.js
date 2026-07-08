class ZipArchive {
  append = jest.fn();
  finalize = jest.fn();
  on = jest.fn();
  pipe = jest.fn();
}

module.exports = {
  ZipArchive
};
