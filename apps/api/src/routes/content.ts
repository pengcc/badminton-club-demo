import express, { Router } from 'express';
import { Content } from '../models/Content';
import { protect, authorize, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/controllerHelpers';
import { ADMIN_ROLES } from '../utils/roles';

const router: Router = express.Router();

// Get all content
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { keys, language } = req.query;

    let query: any = {};

    if (keys) {
      const keyArray = (keys as string).split(',');
      query.key = { $in: keyArray };
    }

    if (language) {
      query.language = language;
    }

    const content = await Content.find(query).populate('updatedBy', 'name');

    // Format as key-value pairs for easier consumption
    const contentMap: Record<string, string> = {};
    content.forEach(item => {
      contentMap[item.key] = item.value;
    });

    res.status(200).json({
      success: true,
      data: contentMap
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}));

// Create or update content (admin only)
router.post('/', protect, authorize(ADMIN_ROLES), asyncHandler(async (req: AuthenticatedRequest, res) => {
  try {
    const { key, value, language } = req.body;

    let content = await Content.findOne({ key, language });

    if (content) {
      // Update existing content
      (content as any).value = value;
      (content as any).updatedBy = req.user.id;
      await content.save();
    } else {
      // Create new content
      content = await Content.create({
        key,
        value,
        language,
        updatedBy: req.user.id
      });
    }

    await content.populate('updatedBy', 'name');

    res.status(200).json({
      success: true,
      data: content
    });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message });
  }
}));

// Delete content (admin only)
router.delete('/:id', protect, authorize(ADMIN_ROLES), asyncHandler(async (req: AuthenticatedRequest, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      return res.status(404).json({ message: 'Content not found' });
    }

    await Content.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}));

export default router;