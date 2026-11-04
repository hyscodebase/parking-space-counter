# Parking data attribution

The included PKLot parking photographs and labels are licensed CC BY 4.0 by the original dataset authors.

**Citation:** Almeida, P., Oliveira, L. S., Silva Jr, E., Britto Jr, A., Koerich, A. (2015). PKLot – A robust dataset for parking lot classification. *Expert Systems with Applications*, 42(11), 4937–4949.

- Official dataset: https://web.inf.ufpr.br/vri/databases/parking-lot-database/
- Official download: https://www.inf.ufpr.br/vri/databases/PKLot.tar.gz
- License: https://creativecommons.org/licenses/by/4.0/
- Full-frame mirror: https://huggingface.co/datasets/dronefreak/PKLot (pinned commit and upstream XML-to-axis-aligned-box conversion recorded in `training/improvements-data/mirror-provenance.json`).

Changes: official segmented patches were converted to RGB, resized to224×224 with Pillow BILINEAR, and JPEG-encoded. Full frames retain source JPEG bytes. Four fixed XML-derived bounding rectangles were cropped and resized for evaluation. The web example uses one previously evaluated public full frame. Manifests preserve source paths, dates, labels and SHA256 values.

The trained model uses these images; no claim is made that small public test sets represent every parking lot.
