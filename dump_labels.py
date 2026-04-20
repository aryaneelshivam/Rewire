import pickle
from tribev2.utils import get_hcp_labels
hcp_labels = get_hcp_labels(mesh="fsaverage5", combine=False, hemi="both")
with open("backend/hcp_labels.pkl", "wb") as f:
    pickle.dump(hcp_labels, f)
print("Labels dumped securely to backend/hcp_labels.pkl!")
