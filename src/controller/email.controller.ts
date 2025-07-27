import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { z, ZodError } from 'zod';
import asyncHandler from '../utils/asyncHandler';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';


// Validation schema
const sendInvitationsSchema = z.object({
    emails: z.array(z.string().email("Invalid email format")).min(1, "At least one email is required"),
    adminId: z.string().min(1, "Admin ID is required")
});

export const sendInvitations = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { emails, adminId } = req.body;
        console.log(emails , adminId , "body");
        

        // Validate input data
        const validatedData = sendInvitationsSchema.parse({
            emails,
            adminId
        });

        // Configure Mailtrap transporter
        const transporter = nodemailer.createTransport({
            host: process.env.MAILTRAP_HOST || "sandbox.smtp.mailtrap.io",
            port: parseInt(process.env.MAILTRAP_PORT || "2525"),
            auth: {
                user: process.env.MAILTRAP_USERNAME,
                pass: process.env.MAILTRAP_PASSWORD
            }
        });

        // Verify transporter configuration
        try {
            await transporter.verify();
        } catch (transporterError) {
            console.error('Transporter verification failed:', transporterError);
            throw new ApiError(500, "Email service configuration error");
        }

        // Create email content
       const registrationLink = `${process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || 'http://localhost:3000'}/register/${validatedData.adminId}`;
        
const emailContent = `Dear Team Member,

You have been invited to join our platform as a staff member!

To complete your registration and set up your account, please click on the link below:

<a href="${registrationLink}" style="color: #007bff; text-decoration: none; font-weight: bold;">Complete Your Registration</a>

This invitation link will allow you to:
- Create your staff account
- Set up your login credentials  
- Access the platform dashboard
- Start collaborating with the team

Please complete your registration within 7 days of receiving this invitation.

If you have any questions or need assistance, please don't hesitate to reach out to your administrator.

Best regards,
The Admin Team

---
Note: This is an automated invitation email. Please do not reply to this message.`;

        // Send emails with proper error handling
        const emailPromises = validatedData.emails.map(async (email: string) => {
            const mailOptions = {
                from: process.env.FROM_EMAIL || '"Admin Team" <admin@yourcompany.com>',
                to: email,
                subject: "Invitation to Join Our Platform - Staff Registration",
                text: emailContent,
                html: emailContent.replace(/\n/g, '<br>').replace(/•/g, '&bull;')
            };

            try {
                const info = await transporter.sendMail(mailOptions);
                console.log(`Email sent successfully to ${email}:`, info.messageId);
                return { email, success: true, messageId: info.messageId };
            } catch (error: any) {
                console.error(`Failed to send email to ${email}:`, error);
                return { 
                    email, 
                    success: false, 
                    error: error.message || 'Unknown email sending error'
                };
            }
        });

        const results = await Promise.all(emailPromises);
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        // If all emails failed, throw an error
        if (successful.length === 0) {
            throw new ApiError(500, "Failed to send any invitation emails");
        }

        return res.status(200).json(
            new ApiResponse(200, {
                totalEmails: validatedData.emails.length,
                successfulSent: successful.length,
                failedSent: failed.length,
                successfulEmails: successful.map(s => s.email),
                failedEmails: failed.map(f => ({ 
                    email: f.email, 
                    error: f.error 
                })),
                registrationLink // Include for reference
            }, `Successfully sent ${successful.length} invitation emails${failed.length > 0 ? `, ${failed.length} failed` : ''}`)
        );

    } catch (error: any) {
        console.error('Send invitations error:', error);
        
        // Handle Zod validation errors
        if (error instanceof ZodError) {
            const validationErrors = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message
            }));
            
            return res.status(400).json(
                new ApiResponse(400, {
                    errors: validationErrors,
                    message: "Validation failed"
                }, "Please check your input data")
            );
        }

        // Handle ApiError instances
        if (error instanceof ApiError) {
            return res.status(error.statusCode).json(
                new ApiResponse(error.statusCode, {
                    message: error.message
                }, error.message)
            );
        }

        // Handle nodemailer specific errors
        if (error.code === 'EAUTH') {
            return res.status(401).json(
                new ApiResponse(401, {
                    message: "Email authentication failed"
                }, "Invalid email credentials")
            );
        }

        if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
            return res.status(503).json(
                new ApiResponse(503, {
                    message: "Email service temporarily unavailable"
                }, "Connection to email service failed")
            );
        }

        if (error.code === 'EMESSAGE') {
            return res.status(400).json(
                new ApiResponse(400, {
                    message: "Invalid email message format"
                }, "Email content validation failed")
            );
        }

        // Handle network/connection errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return res.status(503).json(
                new ApiResponse(503, {
                    message: "Service temporarily unavailable"
                }, "Network connection failed")
            );
        }

        // Handle environment variable errors
        if (error.message?.includes('MAILTRAP') || error.message?.includes('FROM_EMAIL')) {
            return res.status(500).json(
                new ApiResponse(500, {
                    message: "Email service configuration error"
                }, "Missing required environment variables")
            );
        }

        // Generic error handler
        return res.status(500).json(
            new ApiResponse(500, {
                message: "Something went wrong while sending invitations"
            }, "Internal server error")
        );
    }
});

// // Alternative version with different validation approach
// export const sendInvitationsAlternative = asyncHandler(async (req: Request, res: Response) => {
//     try {
//         const { emails, adminId } = req.body;

//         // Manual validation with custom error messages
//         if (!emails || !Array.isArray(emails) || emails.length === 0) {
//             throw new ApiError(400, "No valid emails provided");
//         }

//         if (!adminId || typeof adminId !== 'string') {
//             throw new ApiError(400, "Admin ID is required");
//         }

//         // Validate email formats
//         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//         const invalidEmails = emails.filter(email => !emailRegex.test(email));
        
//         if (invalidEmails.length > 0) {
//             throw new ApiError(400, `Invalid email formats: ${invalidEmails.join(', ')}`);
//         }

//         // Rest of the logic remains the same...
//         // [Implementation continues similar to above]

//     } catch (error: any) {
//         // Error handling similar to above...
//     }
// });