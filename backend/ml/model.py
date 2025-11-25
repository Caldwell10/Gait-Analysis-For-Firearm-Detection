import torch
import torch.nn as nn

class ConvAutoencoder(nn.Module):
    def __init__(self, latent_dim=64, base_channels=32, dropout=0.0):
        super().__init__()

        # Encoder: (1,64,64) → compressed latent
        self.encoder = nn.Sequential(
            nn.Conv2d(1, base_channels, 4, stride=2, padding=1),   # (32,32,32)
            nn.BatchNorm2d(base_channels),
            nn.ReLU(True),

            nn.Conv2d(base_channels, base_channels*2, 4, stride=2, padding=1),  # (64,16,16)
            nn.BatchNorm2d(base_channels*2),
            nn.ReLU(True),

            nn.Conv2d(base_channels*2, base_channels*4, 4, stride=2, padding=1), # (128,8,8)
            nn.BatchNorm2d(base_channels*4),
            nn.ReLU(True),

            nn.Flatten(),
            nn.Linear(base_channels*4*8*8, latent_dim)
        )

        # Decoder: latent → (1,64,64)
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, base_channels*4*8*8),
            nn.Unflatten(1, (base_channels*4, 8, 8)),

            nn.ConvTranspose2d(base_channels*4, base_channels*2, 4, stride=2, padding=1),  # (64,16,16)
            nn.BatchNorm2d(base_channels*2),
            nn.ReLU(True),

            nn.ConvTranspose2d(base_channels*2, base_channels, 4, stride=2, padding=1),    # (32,32,32)
            nn.BatchNorm2d(base_channels),
            nn.ReLU(True),

            nn.ConvTranspose2d(base_channels, 1, 4, stride=2, padding=1),                  # (1,64,64)
            nn.Sigmoid()
        )

        self.dropout = nn.Dropout(dropout) if dropout > 0 else nn.Identity()

    def forward(self, x):
        z = self.encoder(x)
        z = self.dropout(z)
        out = self.decoder(z)
        return out

    def compute_reconstruction_error(self, x):
        recon = self.forward(x)
        return torch.mean((recon - x) ** 2, dim=[1,2,3])

# alias so other scripts can import ConvAE
ConvAE = ConvAutoencoder