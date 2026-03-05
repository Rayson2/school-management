import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  MessageSquare,
  Calendar,
  User,
  GraduationCap,
  ArrowRight,
} from "lucide-react";

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log("Form submitted:", formData);
    alert("Thank you for contacting us! We will get back to you soon.");
    setFormData({
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const contactInfo = [
    {
      icon: MapPin,
      title: "Address",
      details: ["H.B.R. English Medium School", "Bilha, City - 123456"],
    },
    {
      icon: Phone,
      title: "Phone",
      details: ["+91 98765 43210", "+91 12345 67890"],
    },
    {
      icon: Mail,
      title: "Email",
      details: ["info@hbrschool.edu", "admission@hbrschool.edu"],
    },
    {
      icon: Clock,
      title: "Office Hours",
      details: [
        "Monday - Friday: 8:00 AM - 4:00 PM",
        "Saturday: 8:00 AM - 1:00 PM",
      ],
    },
  ];

  const frequentlyAskedQuestions = [
    {
      question: "What is the admission process?",
      answer:
        "Our admission process involves filling out an online application form, followed by an interaction session with the student and parents. Contact us for detailed information.",
    },
    {
      question: "What are the school timings?",
      answer:
        "School operates from 8:00 AM to 3:00 PM on weekdays. Office hours are 8:00 AM to 4:00 PM.",
    },
    {
      question: "Do you provide transport facilities?",
      answer:
        "Yes, we have a comprehensive transport system covering all major areas in and around Bilha.",
    },
    {
      question: "What extracurricular activities do you offer?",
      answer:
        "We offer a wide range of activities including sports, music, dance, art, clubs, and various competitions throughout the year.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="container mx-auto px-4">
          <div className="text-center text-white">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
              Contact Us
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Get In Touch
            </h1>
            <p className="text-xl text-orange-100 max-w-2xl mx-auto">
              We would love to hear from you. Reach out to us for any queries or
              to schedule a visit.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-12 -mt-8 relative z-10">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {contactInfo.map((info, index) => (
              <Card
                key={index}
                className="border-orange-100 hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <info.icon className="w-7 h-7 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {info.title}
                  </h3>
                  {info.details.map((detail, i) => (
                    <p key={i} className="text-gray-600 text-sm">
                      {detail}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form & Map */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Contact Form */}
            <Card className="border-orange-100">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <MessageSquare className="w-6 h-6 text-orange-500" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Send us a Message
                  </h2>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <Input
                          id="name"
                          name="name"
                          placeholder="Your Name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="your@email.com"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="phone" className="text-sm font-medium">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={formData.phone}
                          onChange={handleChange}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="subject" className="text-sm font-medium">
                        Subject
                      </label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <Input
                          id="subject"
                          name="subject"
                          placeholder="Admission / General Query"
                          value={formData.subject}
                          onChange={handleChange}
                          required
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-medium">
                      Message
                    </label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Write your message here..."
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={5}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-orange-500 hover:bg-orange-600"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Map Section */}
            <div className="space-y-4">
              <Card className="border-orange-100 overflow-hidden">
                <CardContent className="p-0">
                  <div className="h-[300px] bg-gray-200 flex items-center justify-center">
                    <div className="text-center p-8">
                      <MapPin className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                      <p className="text-gray-600">
                        Map view will be displayed here
                      </p>
                      <p className="text-gray-500 text-sm">
                        H.B.R. English Medium School, Bilha
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Contact Options */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-orange-100">
                  <CardContent className="p-6 text-center">
                    <Calendar className="w-8 h-8 text-orange-500 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Schedule a Visit
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Book an appointment to visit our campus
                    </p>
                    <Button className="w-full bg-orange-500 hover:bg-orange-600">
                      Book Now
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-orange-100">
                  <CardContent className="p-6 text-center">
                    <MessageSquare className="w-8 h-8 text-orange-500 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Live Chat
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Chat with our admission team
                    </p>
                    <Button
                      variant="outline"
                      className="w-full border-orange-500 text-orange-500 hover:bg-orange-50"
                    >
                      Start Chat
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
              FAQ
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {frequentlyAskedQuestions.map((faq, index) => (
              <Card key={index} className="border-orange-100">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {faq.question}
                  </h3>
                  <p className="text-gray-600">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
